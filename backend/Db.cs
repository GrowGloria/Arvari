using Microsoft.EntityFrameworkCore;

namespace Arvari.Api;

/// <summary>
/// Хранилище. Статьи держим как есть — их JSON целиком (фронт фильтрует и ищет
/// сам, серверу разбирать поля незачем). Вестники и хронология — единый список
/// на ключ. Предложения — обычная таблица, потому что их правят по одному.
/// </summary>
public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<ArticleRow> Articles => Set<ArticleRow>();
    public DbSet<KvRow> Kv => Set<KvRow>();
    public DbSet<SuggestionRow> Suggestions => Set<SuggestionRow>();
    public DbSet<EventRow> Events => Set<EventRow>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<ArticleRow>().HasKey(a => a.Slug);
        b.Entity<KvRow>().HasKey(k => k.Key);
        b.Entity<SuggestionRow>().HasKey(s => s.Id);
        b.Entity<EventRow>().HasKey(e => e.Id);
    }
}

/// <summary>Одна статья: slug + её полный JSON (то, что ждёт фронт).</summary>
public class ArticleRow
{
    public string Slug { get; set; } = "";
    public string Json { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Пара ключ-значение для целиковых списков (news, chronology).</summary>
public class KvRow
{
    public string Key { get; set; } = "";
    public string Json { get; set; } = "[]";
}

public class SuggestionRow
{
    public string Id { get; set; } = "";
    public string Author { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Text { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool Read { get; set; }
}

/// <summary>
/// Событие для статистики: type = view|search|visit, Target = slug статьи или
/// поисковый запрос, Visitor = анонимный id устройства (для примерного числа
/// уникальных). Таблица создаётся вручную в Program (EnsureCreated не добавляет
/// таблицы в уже существующую базу).
/// </summary>
public class EventRow
{
    public int Id { get; set; }
    public string Type { get; set; } = "";
    public string? Target { get; set; }
    public string? Visitor { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
