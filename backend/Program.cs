using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Arvari.Api;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Путь к базе и папке загрузок — из окружения, чтобы указать на постоянный
// диск хостинга (например /data). По умолчанию — рядом с приложением.
var dbPath = Environment.GetEnvironmentVariable("ARVARI_DB") ?? "arvari.db";
var uploadsDir = Environment.GetEnvironmentVariable("ARVARI_UPLOADS")
                 ?? Path.Combine(builder.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(dbPath))!);
Directory.CreateDirectory(uploadsDir);

// PaaS-хостинги передают порт в переменной PORT.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port)) builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Домены фронтенда, которым разрешён доступ. Продакшн-адрес добавляется через
// ARVARI_CORS (можно несколько через запятую); localhost для разработки всегда.
var corsOrigins = new List<string>
{
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4173", "http://127.0.0.1:4173",
};
var extraCors = Environment.GetEnvironmentVariable("ARVARI_CORS");
if (!string.IsNullOrWhiteSpace(extraCors))
    corsOrigins.AddRange(extraCors.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

builder.Services.AddDbContext<AppDb>(o => o.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddSingleton<Auth>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(corsOrigins.ToArray())
    .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
    .WithHeaders("Content-Type", "Authorization")));

var app = builder.Build();

// За обратным прокси хостинга берём реальную схему/домен (для https-URL картинок).
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost,
});

// Создаём базу и наполняем хронологию при первом запуске.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    db.Database.EnsureCreated();
    // Таблица статистики: EnsureCreated не добавляет таблицы в уже существующую
    // базу, поэтому создаём вручную (идемпотентно).
    db.Database.ExecuteSqlRaw(
        "CREATE TABLE IF NOT EXISTS Events (Id INTEGER PRIMARY KEY AUTOINCREMENT, Type TEXT NOT NULL, Target TEXT, Visitor TEXT, CreatedAt TEXT NOT NULL)");
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Events_CreatedAt ON Events (CreatedAt)");
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Events_Type ON Events (Type)");
    db.Database.ExecuteSqlRaw(
        "CREATE TABLE IF NOT EXISTS Revisions (Id INTEGER PRIMARY KEY AUTOINCREMENT, Slug TEXT NOT NULL, Json TEXT NOT NULL, CreatedAt TEXT NOT NULL)");
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Revisions_Slug ON Revisions (Slug)");
    Seed.Chronology(db, app.Environment.ContentRootPath);
}

app.UseCors();

// Единый обработчик ошибок: вместо пустого 500 — понятный JSON.
app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        ctx.RequestServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger("Arvari").LogError(ex, "Необработанная ошибка");
        if (!ctx.Response.HasStarted)
        {
            ctx.Response.StatusCode = 500;
            await ctx.Response.WriteAsJsonAsync(new { message = "Ошибка сервера свода.", detail = ex.Message });
        }
    }
});

// Собранный фронтенд (wwwroot): сам сайт, его ассеты и арты в /uploads.
app.UseDefaultFiles();
app.UseStaticFiles();

// Загруженные Мастером картинки — из папки данных, под префиксом /api/uploads.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsDir),
    RequestPath = "/api/uploads",
});

var auth = app.Services.GetRequiredService<Auth>();
IResult Deny() => Results.Json(new { message = "Доступ Мастера истёк — войдите заново." }, statusCode: 401);

// Все ручки — под /api, чтобы не пересекаться с маршрутами сайта (/chronology
// как страница vs /api/chronology как ручка).
var api = app.MapGroup("/api");

// ---- Авторизация ----
api.MapPost("/auth/login", async (HttpRequest req) =>
{
    var body = await req.ReadFromJsonAsync<JsonObject>();
    var token = auth.Login((string?)body?["passphrase"]);
    if (token is null)
        return Results.Json(new { message = "Слово-ключ не подошло. Архив остаётся запечатан." }, statusCode: 401);
    var name = (string?)body?["name"];
    return Results.Ok(new { token, name = string.IsNullOrWhiteSpace(name) ? "Мастер" : name });
});

// ---- Статьи ----
api.MapGet("/articles", async (HttpRequest req, AppDb db) =>
{
    // Черновики (draft:true) видит только Мастер — игрокам их не отдаём.
    var master = auth.IsMaster(req);
    var rows = await db.Articles.OrderByDescending(a => a.CreatedAt).ToListAsync();
    var nodes = new List<JsonNode?>();
    foreach (var r in rows)
    {
        var node = JsonNode.Parse(r.Json);
        var isDraft = (bool?)node?["draft"] ?? false;
        if (master || !isDraft) nodes.Add(node);
    }
    return Results.Json(new JsonArray(nodes.ToArray()));
});

api.MapGet("/articles/{slug}", async (string slug, HttpRequest req, AppDb db) =>
{
    var row = await db.Articles.FindAsync(slug);
    if (row is null) return Results.NotFound();
    var node = JsonNode.Parse(row.Json)!;
    // Черновик отдаём как «не найдено», если запросил не Мастер.
    if (((bool?)node["draft"] ?? false) && !auth.IsMaster(req)) return Results.NotFound();
    return Results.Json(node);
});

api.MapPost("/articles", async (HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var body = await req.ReadFromJsonAsync<JsonObject>();
    if (body is null) return Results.BadRequest();

    var title = (string?)body["title"] ?? "Без названия";
    var slug = Slugger.Unique(title, s => db.Articles.Any(a => a.Slug == s));
    body["slug"] = slug;
    body["date"] = DateTime.UtcNow.ToString("yyyy-MM-dd");
    body["views"] = 0;
    body["edits"] = 1;
    body["draft"] = ((bool?)body["draft"]) ?? false;

    var json = body.ToJsonString();
    db.Articles.Add(new ArticleRow { Slug = slug, Json = json });
    await AddRevisionAsync(db, slug, json);
    await db.SaveChangesAsync();
    return Results.Json(body);
});

api.MapPut("/articles/{slug}", async (string slug, HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var row = await db.Articles.FindAsync(slug);
    if (row is null) return Results.NotFound();

    var body = await req.ReadFromJsonAsync<JsonObject>();
    if (body is null) return Results.BadRequest();

    var prev = JsonNode.Parse(row.Json)!.AsObject();
    body["slug"] = slug; // адрес не меняется, даже если сменилось название
    body["date"] = prev["date"]?.DeepClone();
    body["views"] = prev["views"]?.DeepClone() ?? 0;
    body["edits"] = ((int?)prev["edits"] ?? 1) + 1;
    body["draft"] = ((bool?)body["draft"]) ?? ((bool?)prev["draft"]) ?? false;

    row.Json = body.ToJsonString();
    await AddRevisionAsync(db, slug, row.Json);
    await db.SaveChangesAsync();
    return Results.Json(body);
});

// ---- История правок (только Мастер) ----
api.MapGet("/articles/{slug}/revisions", async (string slug, HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var rows = await db.Revisions.Where(r => r.Slug == slug)
        .OrderByDescending(r => r.Id).Take(50).ToListAsync();
    return Results.Json(rows.Select(r => new { id = r.Id, createdAt = r.CreatedAt.ToString("o") }));
});

api.MapGet("/articles/{slug}/revisions/{id:int}", async (string slug, int id, HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var rev = await db.Revisions.FirstOrDefaultAsync(r => r.Id == id && r.Slug == slug);
    return rev is null ? Results.NotFound() : Results.Json(JsonNode.Parse(rev.Json));
});

api.MapPost("/articles/{slug}/restore/{id:int}", async (string slug, int id, HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var article = await db.Articles.FindAsync(slug);
    if (article is null) return Results.NotFound();
    var rev = await db.Revisions.FirstOrDefaultAsync(r => r.Id == id && r.Slug == slug);
    if (rev is null) return Results.NotFound();

    var node = JsonNode.Parse(rev.Json)!.AsObject();
    var prev = JsonNode.Parse(article.Json)!.AsObject();
    node["slug"] = slug;
    node["views"] = prev["views"]?.DeepClone() ?? 0; // просмотры не откатываем
    node["date"] = prev["date"]?.DeepClone();
    node["edits"] = ((int?)prev["edits"] ?? 1) + 1;

    var json = node.ToJsonString();
    article.Json = json;
    await AddRevisionAsync(db, slug, json);
    await db.SaveChangesAsync();
    return Results.Json(node);
});

api.MapDelete("/articles/{slug}", async (string slug, HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var row = await db.Articles.FindAsync(slug);
    if (row is not null)
    {
        db.Articles.Remove(row);
        await db.SaveChangesAsync();
    }
    return Results.NoContent();
});

// Просмотр статьи: публичная ручка, любой заход увеличивает счётчик на 1.
// Счётчик лежит внутри JSON статьи (поле views) — правим его на месте.
api.MapPost("/articles/{slug}/view", async (string slug, HttpRequest req, AppDb db) =>
{
    var row = await db.Articles.FindAsync(slug);
    if (row is null) return Results.NotFound();
    var obj = JsonNode.Parse(row.Json)!.AsObject();
    var views = ((int?)obj["views"] ?? 0) + 1;
    obj["views"] = views;
    row.Json = obj.ToJsonString();

    // Заодно пишем событие просмотра в лог статистики (с анонимным id устройства).
    string? visitor = null;
    try { var b = await req.ReadFromJsonAsync<JsonObject>(); visitor = (string?)b?["visitor"]; } catch { /* тела может не быть */ }
    db.Events.Add(new EventRow { Type = "view", Target = slug, Visitor = Clip(visitor, 64) });

    await db.SaveChangesAsync();
    return Results.Ok(new { views });
});

// ---- Статистика: приём событий (публично) и сводка (Мастер) ----
api.MapPost("/events", async (HttpRequest req, AppDb db) =>
{
    var body = await req.ReadFromJsonAsync<JsonObject>();
    var type = ((string?)body?["type"] ?? "").Trim();
    if (type is not ("search" or "visit" or "view")) return Results.BadRequest();
    var target = (string?)body?["key"] ?? (string?)body?["target"];
    if (type == "search") target = (target ?? "").Trim().ToLowerInvariant();
    target = Clip(string.IsNullOrEmpty(target) ? null : target, 200);
    db.Events.Add(new EventRow { Type = type, Target = target, Visitor = Clip((string?)body?["visitor"], 64) });
    await db.SaveChangesAsync();
    return Results.NoContent();
});

api.MapGet("/stats", async (HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var now = DateTime.UtcNow;
    var since30 = now.AddDays(-30);
    var since7 = now.AddDays(-7);

    var totalViews = await db.Events.CountAsync(e => e.Type == "view");
    var totalSearches = await db.Events.CountAsync(e => e.Type == "search");
    var totalVisits = await db.Events.CountAsync(e => e.Type == "visit");
    var uniqueVisitors = await db.Events
        .Where(e => e.Type == "visit" && e.Visitor != null)
        .Select(e => e.Visitor).Distinct().CountAsync();

    // Последние 30 дней грузим в память и считаем всё локально — объём маленький.
    var recent = await db.Events.Where(e => e.CreatedAt >= since30)
        .OrderByDescending(e => e.CreatedAt).ToListAsync();
    var views = recent.Where(e => e.Type == "view").ToList();
    var searches = recent.Where(e => e.Type == "search").ToList();
    var visits = recent.Where(e => e.Type == "visit").ToList();

    static string Day(DateTime d) => d.ToString("yyyy-MM-dd");
    var last14 = Enumerable.Range(0, 14).Select(i => Day(now.AddDays(-13 + i))).ToList();

    return Results.Json(new
    {
        windowDays = 30,
        views = new
        {
            total = totalViews,
            last7 = views.Count(e => e.CreatedAt >= since7),
            perDay = last14.Select(d => new { date = d, count = views.Count(e => Day(e.CreatedAt) == d) }),
            top = views.Where(e => e.Target != null).GroupBy(e => e.Target!)
                .Select(g => new { slug = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count).Take(10),
        },
        searches = new
        {
            total = totalSearches,
            last7 = searches.Count(e => e.CreatedAt >= since7),
            top = searches.Where(e => !string.IsNullOrWhiteSpace(e.Target)).GroupBy(e => e.Target!)
                .Select(g => new { query = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count).Take(15),
            recent = searches.Take(25).Select(e => new { query = e.Target, at = e.CreatedAt.ToString("o") }),
        },
        visits = new
        {
            total = totalVisits,
            last7 = visits.Count(e => e.CreatedAt >= since7),
            uniqueTotal = uniqueVisitors,
            perDay = last14.Select(d => new
            {
                date = d,
                count = visits.Count(e => Day(e.CreatedAt) == d),
                unique = visits.Where(e => Day(e.CreatedAt) == d).Select(e => e.Visitor).Distinct().Count(),
            }),
        },
    });
});

// ---- Вестники и хронология (целиковые списки) ----
async Task<IResult> GetList(AppDb db, string key)
{
    var row = await db.Kv.FindAsync(key);
    return Results.Json(JsonNode.Parse(row?.Json ?? "[]"));
}

async Task<IResult> PutList(HttpRequest req, AppDb db, string key)
{
    if (!auth.IsMaster(req)) return Deny();
    var body = await req.ReadFromJsonAsync<JsonArray>();
    if (body is null) return Results.BadRequest();
    var row = await db.Kv.FindAsync(key);
    if (row is null) db.Kv.Add(new KvRow { Key = key, Json = body.ToJsonString() });
    else row.Json = body.ToJsonString();
    await db.SaveChangesAsync();
    return Results.Json(body);
}

api.MapGet("/news", (AppDb db) => GetList(db, "news"));
api.MapPut("/news", (HttpRequest req, AppDb db) => PutList(req, db, "news"));
api.MapGet("/chronology", (AppDb db) => GetList(db, "chronology"));
api.MapPut("/chronology", (HttpRequest req, AppDb db) => PutList(req, db, "chronology"));
api.MapGet("/journal", (AppDb db) => GetList(db, "journal"));
api.MapPut("/journal", (HttpRequest req, AppDb db) => PutList(req, db, "journal"));

// ---- Предложка ----
api.MapGet("/suggestions", async (HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var rows = await db.Suggestions.OrderByDescending(s => s.CreatedAt).ToListAsync();
    return Results.Json(rows.Select(ToDto));
});

api.MapPost("/suggestions", async (HttpRequest req, AppDb db) =>
{
    var body = await req.ReadFromJsonAsync<JsonObject>();
    var text = ((string?)body?["text"] ?? "").Trim();
    if (text.Length == 0) return Results.BadRequest(new { message = "Напишите текст предложения." });

    var row = new SuggestionRow
    {
        Id = "s-" + Guid.NewGuid().ToString("N")[..12],
        Author = ((string?)body?["author"] ?? "").Trim(),
        Kind = (string?)body?["kind"] ?? "Идея",
        Text = text,
    };
    db.Suggestions.Add(row);
    await db.SaveChangesAsync();
    return Results.Json(ToDto(row));
});

api.MapMethods("/suggestions/{id}", ["PATCH"], async (string id, HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var row = await db.Suggestions.FindAsync(id);
    if (row is null) return Results.NotFound();
    var body = await req.ReadFromJsonAsync<JsonObject>();
    if (body?["read"] is not null) row.Read = (bool)body["read"]!;
    await db.SaveChangesAsync();
    return Results.NoContent();
});

api.MapDelete("/suggestions/{id}", async (string id, HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var row = await db.Suggestions.FindAsync(id);
    if (row is not null)
    {
        db.Suggestions.Remove(row);
        await db.SaveChangesAsync();
    }
    return Results.NoContent();
});

// ---- Загрузка изображений ----
api.MapPost("/uploads", async (HttpRequest req) =>
{
    if (!auth.IsMaster(req)) return Deny();
    if (!req.HasFormContentType) return Results.BadRequest();
    var form = await req.ReadFormAsync();
    var file = form.Files["file"];
    if (file is null || file.Length == 0) return Results.BadRequest(new { message = "Файл не получен." });

    var safe = Path.GetFileName(file.FileName);
    var name = $"{Guid.NewGuid().ToString("N")[..8]}-{safe}";
    var path = Path.Combine(uploadsDir, name);
    await using (var stream = File.Create(path))
        await file.CopyToAsync(stream);

    // Относительный путь того же origin — работает за любым доменом/прокси.
    var url = $"/api/uploads/{Uri.EscapeDataString(name)}";
    return Results.Ok(new { url });
});

// Превью ссылок: прямой заход/краулер на /article/{slug} получает index.html
// с OG-мета конкретной статьи (в Telegram/Discord развернётся карточка с
// названием, описанием и обложкой). Клиентская навигация внутри SPA сюда не
// попадает — это только самый первый заход по ссылке.
var publicBase = (Environment.GetEnvironmentVariable("ARVARI_PUBLIC_URL") ?? "").TrimEnd('/');
var webRoot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
var indexHtmlPath = Path.Combine(webRoot, "index.html");
app.MapGet("/article/{slug}", async (string slug, HttpRequest req, AppDb db) =>
{
    if (!File.Exists(indexHtmlPath)) return Results.NotFound();
    var html = await File.ReadAllTextAsync(indexHtmlPath);
    var row = await db.Articles.FindAsync(slug);
    if (row is not null)
    {
        var node = JsonNode.Parse(row.Json)!;
        // Черновик в превью не раскрываем (его и так не видно игрокам).
        if (!((bool?)node["draft"] ?? false))
        {
            var title = ((string?)node["title"] ?? "Арвари").Trim();
            var desc = OgText((string?)node["excerpt"] ?? (string?)node["lead"] ?? "");
            var image = AbsUrl(publicBase, req, (string?)(node["cover"]?["image"]) ?? (string?)(node["infobox"]?["image"]));
            html = InjectOg(html, $"{title} — Арвари", desc, image, AbsUrl(publicBase, req, $"/article/{slug}"));
        }
    }
    return Results.Content(html, "text/html; charset=utf-8");
});

// Клиентские маршруты сайта (/catalog, /article/…) отдаём index.html — роутер
// разберётся уже в браузере. Стоит после /api, поэтому ручки в приоритете.
app.MapFallbackToFile("index.html");

app.Run();

static object ToDto(SuggestionRow s) => new
{
    id = s.Id,
    author = s.Author,
    kind = s.Kind,
    text = s.Text,
    createdAt = s.CreatedAt.ToString("o"),
    read = s.Read,
};

// Обрезает строку до max символов (и пустую превращает в null) — для лога.
static string? Clip(string? s, int max) =>
    string.IsNullOrEmpty(s) ? null : (s.Length > max ? s[..max] : s);

// Добавляет снимок статьи в историю, оставляя последние 50 версий на статью.
static async Task AddRevisionAsync(AppDb db, string slug, string json)
{
    var extra = await db.Revisions.Where(r => r.Slug == slug)
        .OrderByDescending(r => r.Id).Skip(49).ToListAsync();
    if (extra.Count > 0) db.Revisions.RemoveRange(extra);
    db.Revisions.Add(new RevisionRow { Slug = slug, Json = json });
}

// ---- OG-превью: сборка мета-тегов ----

// Абсолютный URL. Если задан ARVARI_PUBLIC_URL (напр. https://arvariwiki.ru) —
// берём его; иначе схему/домен запроса (за прокси может быть …ts.net).
static string AbsUrl(string publicBase, HttpRequest req, string? path)
{
    if (string.IsNullOrEmpty(path)) return "";
    if (path.StartsWith("http://") || path.StartsWith("https://")) return path;
    var b = !string.IsNullOrEmpty(publicBase) ? publicBase : $"{req.Scheme}://{req.Host}";
    return b + (path.StartsWith("/") ? path : "/" + path);
}

static string HtmlEsc(string? s) => (s ?? "")
    .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
    .Replace("\"", "&quot;").Replace("'", "&#39;");

static string OgText(string? s)
{
    if (string.IsNullOrEmpty(s)) return "";
    var t = Regex.Replace(s, "\\s+", " ").Trim();
    return t.Length > 200 ? t[..197] + "…" : t;
}

static string InjectOg(string html, string title, string desc, string image, string url)
{
    var og = "<!-- OG -->"
        + "<meta property=\"og:type\" content=\"article\" />"
        + "<meta property=\"og:site_name\" content=\"Арвари\" />"
        + $"<meta property=\"og:title\" content=\"{HtmlEsc(title)}\" />"
        + $"<meta property=\"og:description\" content=\"{HtmlEsc(desc)}\" />"
        + $"<meta property=\"og:url\" content=\"{HtmlEsc(url)}\" />";
    if (!string.IsNullOrEmpty(image))
        og += $"<meta property=\"og:image\" content=\"{HtmlEsc(image)}\" />"
            + "<meta name=\"twitter:card\" content=\"summary_large_image\" />"
            + $"<meta name=\"twitter:image\" content=\"{HtmlEsc(image)}\" />";
    else
        og += "<meta name=\"twitter:card\" content=\"summary\" />";
    og += $"<meta name=\"twitter:title\" content=\"{HtmlEsc(title)}\" />"
        + $"<meta name=\"twitter:description\" content=\"{HtmlEsc(desc)}\" />"
        + "<!-- /OG -->";

    // MatchEvaluator (а не строка-замена) — чтобы символы $ в тексте статьи
    // не воспринимались как подстановки регэкспа.
    html = Regex.Replace(html, "<!-- OG -->.*?<!-- /OG -->", _ => og, RegexOptions.Singleline);
    html = Regex.Replace(html, "<title>.*?</title>", _ => $"<title>{HtmlEsc(title)}</title>", RegexOptions.Singleline);
    return html;
}
