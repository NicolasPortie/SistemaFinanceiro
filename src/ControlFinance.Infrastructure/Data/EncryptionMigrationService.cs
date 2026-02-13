using ControlFinance.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace ControlFinance.Infrastructure.Data;

/// <summary>
/// Serviço responsável por criptografar dados sensíveis existentes no banco de dados.
/// Deve ser executado UMA VEZ após ativar a criptografia.
/// Detecta automaticamente dados já criptografados e pula-os.
/// </summary>
public class EncryptionMigrationService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EncryptionMigrationService> _logger;

    public EncryptionMigrationService(IConfiguration configuration, ILogger<EncryptionMigrationService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task MigrarDadosAsync()
    {
        var keyBase64 = _configuration["Encryption:Key"]
            ?? throw new InvalidOperationException("Encryption:Key não configurada.");
        var key = Convert.FromBase64String(keyBase64);

        var connectionString = _configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionString não configurada.");

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();

        _logger.LogInformation("Iniciando migração de criptografia de dados sensíveis...");

        // 1. Criptografar emails dos usuários
        await MigrarColunaAsync(connection, key, "usuarios", "id", "email",
            deterministic: true, description: "Email dos usuários");

        // 2. Criptografar códigos de verificação
        await MigrarColunaAsync(connection, key, "codigos_verificacao", "id", "codigo",
            deterministic: true, description: "Códigos de verificação");

        // 3. Criptografar tokens de refresh
        await MigrarColunaAsync(connection, key, "refresh_tokens", "id", "token",
            deterministic: true, description: "Refresh tokens");

        // 4. Criptografar tokens substituídos
        await MigrarColunaAsync(connection, key, "refresh_tokens", "id", "substituido_por",
            deterministic: true, description: "Tokens substituídos");

        // 5. Criptografar IPs de criação
        await MigrarColunaAsync(connection, key, "refresh_tokens", "id", "ip_criacao",
            deterministic: false, description: "IPs de criação");

        // 6. Alterar tamanhos de coluna para suportar dados criptografados
        await AlterarTamanhosColunasAsync(connection);

        _logger.LogInformation("Migração de criptografia concluída com sucesso!");
    }

    private async Task MigrarColunaAsync(
        NpgsqlConnection connection,
        byte[] key,
        string tabela,
        string colunaId,
        string colunaDados,
        bool deterministic,
        string description)
    {
        _logger.LogInformation("Migrando {Description}...", description);
        int totalMigrados = 0;
        int totalPulados = 0;

        // Ler todos os registros
        await using var readCmd = new NpgsqlCommand(
            $"SELECT {colunaId}, {colunaDados} FROM {tabela} WHERE {colunaDados} IS NOT NULL", connection);

        var registros = new List<(int id, string valor)>();
        await using (var reader = await readCmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                var id = reader.GetInt32(0);
                var valor = reader.GetString(1);
                registros.Add((id, valor));
            }
        }

        foreach (var (id, valor) in registros)
        {
            // Verificar se já está criptografado (tenta descriptografar)
            var decrypted = EncryptionHelper.Decrypt(valor, key);
            if (decrypted != valor)
            {
                // Já está criptografado (descriptografou com sucesso e resultado é diferente do armazenado)
                totalPulados++;
                continue;
            }

            // Verificar se parece Base64 válido com tamanho compatível com AES
            // (dados criptografados são sempre Base64 e maiores que o original)
            if (IsLikelyEncrypted(valor))
            {
                totalPulados++;
                continue;
            }

            // Criptografar o valor original
            var encrypted = deterministic
                ? EncryptionHelper.EncryptDeterministic(valor, key)
                : EncryptionHelper.EncryptNonDeterministic(valor, key);

            await using var updateCmd = new NpgsqlCommand(
                $"UPDATE {tabela} SET {colunaDados} = @valor WHERE {colunaId} = @id", connection);
            updateCmd.Parameters.AddWithValue("valor", encrypted);
            updateCmd.Parameters.AddWithValue("id", id);
            await updateCmd.ExecuteNonQueryAsync();

            totalMigrados++;
        }

        _logger.LogInformation("  {Description}: {Migrados} migrados, {Pulados} já criptografados",
            description, totalMigrados, totalPulados);
    }

    private static bool IsLikelyEncrypted(string value)
    {
        if (string.IsNullOrEmpty(value)) return false;

        try
        {
            var bytes = Convert.FromBase64String(value);
            // Dados criptografados AES têm pelo menos IV (16) + 1 bloco (16) = 32 bytes
            // E o tamanho do ciphertext (sem IV) é múltiplo de 16
            return bytes.Length >= 32 && (bytes.Length - 16) % 16 == 0;
        }
        catch
        {
            return false;
        }
    }

    private async Task AlterarTamanhosColunasAsync(NpgsqlConnection connection)
    {
        _logger.LogInformation("Ajustando tamanhos de colunas para dados criptografados...");

        var alteracoes = new[]
        {
            "ALTER TABLE usuarios ALTER COLUMN email TYPE varchar(600)",
            "ALTER TABLE codigos_verificacao ALTER COLUMN codigo TYPE varchar(200)",
            "ALTER TABLE refresh_tokens ALTER COLUMN token TYPE varchar(800)",
            "ALTER TABLE refresh_tokens ALTER COLUMN substituido_por TYPE varchar(800)",
            "ALTER TABLE refresh_tokens ALTER COLUMN ip_criacao TYPE varchar(200)"
        };

        foreach (var sql in alteracoes)
        {
            try
            {
                await using var cmd = new NpgsqlCommand(sql, connection);
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Aviso ao alterar coluna: {Message}", ex.Message);
            }
        }
    }
}
