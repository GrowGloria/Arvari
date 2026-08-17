namespace Arvari.Api;

/// <summary>
/// Первичное наполнение. Статьи, вестники и предложения стартуют пустыми —
/// их пишет Мастер. А хронологию засеваем из Seed/chronology.json, чтобы лента
/// не была пустой на свежей базе (это готовый контент мира, а не демо).
/// </summary>
public static class Seed
{
    public static void Chronology(AppDb db, string contentRoot)
    {
        if (db.Kv.Any(k => k.Key == "chronology")) return;

        var path = Path.Combine(contentRoot, "Seed", "chronology.json");
        var json = File.Exists(path) ? File.ReadAllText(path) : "[]";

        db.Kv.Add(new KvRow { Key = "chronology", Json = json });
        db.SaveChanges();
    }
}
