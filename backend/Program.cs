using System.Text.Json;
using System.Text.Json.Nodes;
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

    db.Articles.Add(new ArticleRow { Slug = slug, Json = body.ToJsonString() });
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
    await db.SaveChangesAsync();
    return Results.Json(body);
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
api.MapPost("/articles/{slug}/view", async (string slug, AppDb db) =>
{
    var row = await db.Articles.FindAsync(slug);
    if (row is null) return Results.NotFound();
    var obj = JsonNode.Parse(row.Json)!.AsObject();
    var views = ((int?)obj["views"] ?? 0) + 1;
    obj["views"] = views;
    row.Json = obj.ToJsonString();
    await db.SaveChangesAsync();
    return Results.Ok(new { views });
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
