using Npgsql;

var connStrings = new[]
{
    "Host=localhost;Port=5432;Database=controlfinance;Username=postgres;Password=admin",
    "Host=localhost;Port=5432;Database=controlfinance;Username=cf_user;Password=cf_password_dev"
};

var mode = args.Length > 0 ? args[0].ToLowerInvariant() : "users";
var marker = args.Length > 1 ? args[1] : "";

foreach (var connString in connStrings)
{
    try
    {
        await using var conn = new NpgsqlConnection(connString);
        await conn.OpenAsync();

        if (mode == "lancamentos")
        {
            const string sql = """
                select l.id, l.descricao, l.valor, l.tipo, l.forma_pagamento, l.numero_parcelas, l.data
                from lancamentos l
                where l.descricao ilike @pattern
                order by l.id desc
                limit 50;
                """;

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("pattern", $"%{marker}%");
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var id = reader.GetInt32(0);
                var descricao = reader.IsDBNull(1) ? "" : reader.GetString(1);
                var valor = reader.IsDBNull(2) ? "null" : reader.GetDecimal(2).ToString("0.00");
                var tipo = reader.IsDBNull(3) ? "null" : reader.GetInt32(3).ToString();
                var forma = reader.IsDBNull(4) ? "null" : reader.GetInt32(4).ToString();
                var parcelas = reader.IsDBNull(5) ? "null" : reader.GetInt32(5).ToString();
                var data = reader.IsDBNull(6) ? "null" : reader.GetDateTime(6).ToString("yyyy-MM-dd");
                Console.WriteLine($"{id}|{descricao}|{valor}|{tipo}|{forma}|{parcelas}|{data}");
            }

            return;
        }

        if (mode == "limites")
        {
            const string sql = """
                select l.id, c.nome, l.valor_limite, l.ativo
                from limites_categoria l
                inner join categorias c on c.id = l.categoria_id
                where c.nome ilike @pattern
                order by l.id desc
                limit 50;
                """;

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("pattern", $"%{marker}%");
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var id = reader.GetInt32(0);
                var nome = reader.IsDBNull(1) ? "" : reader.GetString(1);
                var valor = reader.IsDBNull(2) ? "null" : reader.GetDecimal(2).ToString("0.00");
                var ativo = !reader.IsDBNull(3) && reader.GetBoolean(3);
                Console.WriteLine($"{id}|{nome}|{valor}|{ativo}");
            }

            return;
        }

        if (mode == "metas")
        {
            const string sql = """
                select id, nome, valor_alvo, prazo, status
                from metas_financeiras
                where nome ilike @pattern
                order by id desc
                limit 50;
                """;

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("pattern", $"%{marker}%");
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var id = reader.GetInt32(0);
                var nome = reader.IsDBNull(1) ? "" : reader.GetString(1);
                var alvo = reader.IsDBNull(2) ? "null" : reader.GetDecimal(2).ToString("0.00");
                var prazo = reader.IsDBNull(3) ? "null" : reader.GetDateTime(3).ToString("yyyy-MM-dd");
                var status = reader.IsDBNull(4) ? "null" : reader.GetInt32(4).ToString();
                Console.WriteLine($"{id}|{nome}|{alvo}|{prazo}|{status}");
            }

            return;
        }

        if (mode == "lembretes")
        {
            const string sql = """
                select id, usuario_id, descricao, valor, data_vencimento, recorrente_mensal, dia_recorrente, ativo
                from lembretes_pagamento
                where descricao ilike @pattern
                order by id desc
                limit 50;
                """;

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("pattern", $"%{marker}%");
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var id = reader.GetInt32(0);
                var userId = reader.GetInt32(1);
                var descricao = reader.GetString(2);
                var valor = reader.IsDBNull(3) ? "null" : reader.GetDecimal(3).ToString("0.00");
                var venc = reader.GetDateTime(4).ToString("yyyy-MM-dd");
                var recorrente = !reader.IsDBNull(5) && reader.GetBoolean(5);
                var dia = reader.IsDBNull(6) ? "null" : reader.GetInt32(6).ToString();
                var ativo = !reader.IsDBNull(7) && reader.GetBoolean(7);
                Console.WriteLine($"{id}|{userId}|{descricao}|{valor}|{venc}|{recorrente}|{dia}|{ativo}");
            }

            return;
        }

        const string usersSql = """
            select id, nome, email, telegram_chat_id, telegram_vinculado
            from usuarios
            order by id;
            """;

        await using var usersCmd = new NpgsqlCommand(usersSql, conn);
        await using var usersReader = await usersCmd.ExecuteReaderAsync();
        while (await usersReader.ReadAsync())
        {
            var id = usersReader.GetInt32(0);
            var nome = usersReader.IsDBNull(1) ? "" : usersReader.GetString(1);
            var email = usersReader.IsDBNull(2) ? "" : usersReader.GetString(2);
            var chat = usersReader.IsDBNull(3) ? "null" : usersReader.GetInt64(3).ToString();
            var vinc = !usersReader.IsDBNull(4) && usersReader.GetBoolean(4);
            Console.WriteLine($"{id}|{nome}|{email}|chat:{chat}|vinc:{vinc}");
        }

        return;
    }
    catch
    {
        // try next conn string
    }
}

Console.Error.WriteLine("Nao foi possivel conectar ao banco.");
Environment.Exit(1);
