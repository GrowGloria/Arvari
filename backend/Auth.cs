using System.Security.Cryptography;
using System.Text;

namespace Arvari.Api;

/// <summary>
/// Аутентификация Мастера. Роль одна, пользователь один, поэтому без тяжёлого
/// JWT-стека: токен — детерминированная подпись секретом, переживает перезапуск
/// и не требует хранения. Проверка на каждой правящей ручке.
///
/// Секрет и слово-ключ берутся из переменных окружения:
///   ARVARI_PASSPHRASE — слово-ключ входа (по умолчанию «арвари» для разработки)
///   ARVARI_SECRET     — секрет подписи токена (по умолчанию случайный на сессию)
/// </summary>
public class Auth
{
    private readonly string _passphrase;
    private readonly byte[] _secret;
    private readonly string _token;

    public Auth(IConfiguration config)
    {
        _passphrase = Environment.GetEnvironmentVariable("ARVARI_PASSPHRASE") ?? "арвари";
        var secretStr = Environment.GetEnvironmentVariable("ARVARI_SECRET")
                        ?? Guid.NewGuid().ToString("N");
        _secret = Encoding.UTF8.GetBytes(secretStr);
        _token = Sign("arvari-master");
    }

    private string Sign(string payload)
    {
        using var hmac = new HMACSHA256(_secret);
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    /// <summary>Проверяет слово-ключ и выдаёт токен, иначе null.</summary>
    public string? Login(string? passphrase)
    {
        var ok = (passphrase ?? "").Trim().Equals(_passphrase.Trim(), StringComparison.OrdinalIgnoreCase);
        return ok ? _token : null;
    }

    /// <summary>Токен из заголовка Authorization: Bearer … валиден?</summary>
    public bool IsMaster(HttpRequest req)
    {
        var header = req.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return false;
        var token = header["Bearer ".Length..].Trim();
        // Сравнение постоянного времени, чтобы не подбирали по таймингу.
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(token),
            Encoding.UTF8.GetBytes(_token));
    }
}
