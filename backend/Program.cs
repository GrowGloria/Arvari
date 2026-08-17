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

// Загруженные картинки отдаём как статику из папки uploads (см. uploadsDir выше).
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsDir),
    RequestPath = "/uploads",
});

var auth = app.Services.GetRequiredService<Auth>();
IResult Deny() => Results.Json(new { message = "Доступ Мастера истёк — войдите заново." }, statusCode: 401);

// ---- Авторизация ----
app.MapPost("/auth/login", async (HttpRequest req) =>
{
    var body = await req.ReadFromJsonAsync<JsonObject>();
    var token = auth.Login((string?)body?["passphrase"]);
    if (token is null)
        return Results.Json(new { message = "Слово-ключ не подошло. Архив остаётся запечатан." }, statusCode: 401);
    var name = (string?)body?["name"];
    return Results.Ok(new { token, name = string.IsNullOrWhiteSpace(name) ? "Мастер" : name });
});

// ---- Статьи ----
app.MapGet("/articles", async (AppDb db) =>
{
    var rows = await db.Articles.OrderByDescending(a => a.CreatedAt).ToListAsync();
    var arr = new JsonArray(rows.Select(r => JsonNode.Parse(r.Json)).ToArray());
    return Results.Json(arr);
});

app.MapGet("/articles/{slug}", async (string slug, AppDb db) =>
{
    var row = await db.Articles.FindAsync(slug);
    return row is null ? Results.NotFound() : Results.Json(JsonNode.Parse(row.Json));
});

app.MapPost("/articles", async (HttpRequest req, AppDb db) =>
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

    db.Articles.Add(new ArticleRow { Slug = slug, Json = body.ToJsonString() });
    await db.SaveChangesAsync();
    return Results.Json(body);
});

app.MapPut("/articles/{slug}", async (string slug, HttpRequest req, AppDb db) =>
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

    row.Json = body.ToJsonString();
    await db.SaveChangesAsync();
    return Results.Json(body);
});

app.MapDelete("/articles/{slug}", async (string slug, HttpRequest req, AppDb db) =>
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

app.MapGet("/news", (AppDb db) => GetList(db, "news"));
app.MapPut("/news", (HttpRequest req, AppDb db) => PutList(req, db, "news"));
app.MapGet("/chronology", (AppDb db) => GetList(db, "chronology"));
app.MapPut("/chronology", (HttpRequest req, AppDb db) => PutList(req, db, "chronology"));

// ---- Предложка ----
app.MapGet("/suggestions", async (HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var rows = await db.Suggestions.OrderByDescending(s => s.CreatedAt).ToListAsync();
    return Results.Json(rows.Select(ToDto));
});

app.MapPost("/suggestions", async (HttpRequest req, AppDb db) =>
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

app.MapMethods("/suggestions/{id}", ["PATCH"], async (string id, HttpRequest req, AppDb db) =>
{
    if (!auth.IsMaster(req)) return Deny();
    var row = await db.Suggestions.FindAsync(id);
    if (row is null) return Results.NotFound();
    var body = await req.ReadFromJsonAsync<JsonObject>();
    if (body?["read"] is not null) row.Read = (bool)body["read"]!;
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.MapDelete("/suggestions/{id}", async (string id, HttpRequest req, AppDb db) =>
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
app.MapPost("/uploads", async (HttpRequest req) =>
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

    var url = $"{req.Scheme}://{req.Host}/uploads/{Uri.EscapeDataString(name)}";
    return Results.Ok(new { url });
});

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
