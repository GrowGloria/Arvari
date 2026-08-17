using System.Text;
using System.Text.RegularExpressions;

namespace Arvari.Api;

/// <summary>
/// Транслитерация адресов статей. ОБЯЗАН совпадать с src/lib/slug.js на фронте:
/// вики-ссылка [[Аэрондиль]] превращается в slug той же логикой, и по нему
/// ищется статья. Правила зафиксированы тестами slug.test.js.
/// </summary>
public static class Slugger
{
    private static readonly Dictionary<char, string> Map = new()
    {
        ['а'] = "a", ['б'] = "b", ['в'] = "v", ['г'] = "g", ['д'] = "d", ['е'] = "e",
        ['ё'] = "e", ['ж'] = "zh", ['з'] = "z", ['и'] = "i", ['й'] = "y", ['к'] = "k",
        ['л'] = "l", ['м'] = "m", ['н'] = "n", ['о'] = "o", ['п'] = "p", ['р'] = "r",
        ['с'] = "s", ['т'] = "t", ['у'] = "u", ['ф'] = "f", ['х'] = "h", ['ц'] = "ts",
        ['ч'] = "ch", ['ш'] = "sh", ['щ'] = "shch", ['ъ'] = "", ['ы'] = "y", ['ь'] = "",
        ['э'] = "e", ['ю'] = "yu", ['я'] = "ya",
    };

    public static string Slugify(string text)
    {
        var sb = new StringBuilder();
        foreach (var ch in text.ToLowerInvariant())
        {
            sb.Append(Map.TryGetValue(ch, out var mapped) ? mapped : ch);
        }
        var slug = Regex.Replace(sb.ToString(), "[^a-z0-9]+", "-");
        return slug.Trim('-');
    }

    /// <summary>Уникальный slug: при коллизии дописывает -2, -3, … </summary>
    public static string Unique(string title, Func<string, bool> exists)
    {
        var baseSlug = Slugify(title);
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "statya";
        if (!exists(baseSlug)) return baseSlug;
        for (var i = 2; ; i++)
        {
            var candidate = $"{baseSlug}-{i}";
            if (!exists(candidate)) return candidate;
        }
    }
}
