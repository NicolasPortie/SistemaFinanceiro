using ControlFinance.Application.DTOs.Importacao;
using ControlFinance.Application.Interfaces;
using ControlFinance.Application.Services.Importacao;
using ControlFinance.Application.Services.Importacao.BancoProfiles;
using ControlFinance.Application.Services.Importacao.Categorizacao;
using ControlFinance.Application.Services.Importacao.Parsers;
using ControlFinance.Domain.Entities;
using ControlFinance.Domain.Enums;
using ControlFinance.Domain.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;
using System.Text;

namespace ControlFinance.Tests;

public class ImportacaoServiceTests
{
    #region CsvFileParser

    [Fact]
    public async Task CsvParser_SemicolonSeparated_ParsesCorrectly()
    {
        var parser = CreateCsvParser();
        var csv = "Data;Descricao;Valor\n01/01/2024;COMPRA SUPERMERCADO;-150,00\n02/01/2024;PIX RECEBIDO;500,00";
        using var stream = ToStream(csv);

        var result = await parser.ParseAsync(stream, "extrato.csv", null);

        Assert.True(result.Sucesso);
        Assert.Equal(2, result.Transacoes.Count);
        Assert.Equal("COMPRA SUPERMERCADO", result.Transacoes[0].DescricaoRaw);
        Assert.Equal("-150,00", result.Transacoes[0].ValorRaw);
    }

    [Fact]
    public async Task CsvParser_CommaSeparated_ParsesCorrectly()
    {
        var parser = CreateCsvParser();
        var csv = "Date,Description,Amount\n2024-01-01,GROCERY STORE,-50.00\n2024-01-02,SALARY,3000.00";
        using var stream = ToStream(csv);

        var result = await parser.ParseAsync(stream, "statement.csv", null);

        Assert.True(result.Sucesso);
        Assert.Equal(2, result.Transacoes.Count);
    }

    [Fact]
    public async Task CsvParser_QuotedFields_HandledCorrectly()
    {
        var parser = CreateCsvParser();
        var csv = "Data;Descricao;Valor\n01/01/2024;\"DESC COM; PONTO E VIRGULA\";-100,50";
        using var stream = ToStream(csv);

        var result = await parser.ParseAsync(stream, "extrato.csv", null);

        Assert.True(result.Sucesso);
        Assert.Single(result.Transacoes);
        Assert.Contains("PONTO E VIRGULA", result.Transacoes[0].DescricaoRaw);
    }

    [Fact]
    public async Task CsvParser_Latin1Encoding_DetectedCorrectly()
    {
        var parser = CreateCsvParser();
        var csv = "Data;Descrição;Valor\n01/01/2024;CAFÉ DA MANHÃ;-25,00";
        var bytes = Encoding.Latin1.GetBytes(csv);
        using var stream = new MemoryStream(bytes);

        var result = await parser.ParseAsync(stream, "extrato.csv", null);

        Assert.True(result.Sucesso);
        Assert.Single(result.Transacoes);
    }

    [Fact]
    public async Task CsvParser_EmptyFile_ReturnsFailure()
    {
        var parser = CreateCsvParser();
        using var stream = ToStream("");

        var result = await parser.ParseAsync(stream, "empty.csv", null);

        Assert.False(result.Sucesso);
    }

    [Fact]
    public void CsvParser_Formato_IsCsv()
    {
        var parser = CreateCsvParser();
        Assert.Equal(FormatoArquivo.CSV, parser.Formato);
    }

    [Fact]
    public void CsvParser_PodeProcessar_ValidExtension()
    {
        var parser = CreateCsvParser();
        using var stream = ToStream("test");
        Assert.True(parser.PodeProcessar("file.csv", stream));
        Assert.False(parser.PodeProcessar("file.xlsx", stream));
    }

    #endregion

    #region NormalizacaoService

    [Theory]
    [InlineData("  COMPRA  SUPERMERCADO  ", "COMPRA SUPERMERCADO")]
    [InlineData("pix recebido", "PIX RECEBIDO")]
    [InlineData("  teste  ", "TESTE")]
    public void Normalizacao_Descricao_NormalizesCorrectly(string input, string expected)
    {
        var result = NormalizacaoService.NormalizarDescricao(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Normalizacao_Descricao_RemovesInvisibleChars()
    {
        // Zero-width space
        var result = NormalizacaoService.NormalizarDescricao("TEST\u200BVALUE");
        Assert.Equal("TESTVALUE", result);
    }

    [Fact]
    public void Normalizacao_Normalizar_ProcessesRawTransactions()
    {
        var service = new NormalizacaoService(CreateLogger<NormalizacaoService>());
        var rawList = new List<RawTransacaoImportada>
        {
            new()
            {
                IndiceOriginal = 0,
                DataRaw = "01/01/2024",
                DescricaoRaw = "COMPRA SUPERMERCADO",
                ValorRaw = "-150,50"
            },
            new()
            {
                IndiceOriginal = 1,
                DataRaw = "02/01/2024",
                DescricaoRaw = "PIX RECEBIDO JOAO",
                ValorRaw = "500,00"
            }
        };

        var result = service.Normalizar(rawList);

        Assert.Equal(2, result.Count);
        Assert.Equal(-150.50m, result[0].Valor);
        Assert.Equal(TipoTransacao.Debito, result[0].TipoTransacao);
        Assert.Equal(500m, result[1].Valor);
        // "PIX RECEBIDO" contains credit keyword → Credito
        Assert.Equal(TipoTransacao.Credito, result[1].TipoTransacao);
    }

    [Theory]
    [InlineData("01/01/2024")]
    [InlineData("2024-01-01")]
    [InlineData("01/01/24")]
    [InlineData("1/1/2024")]
    public void Normalizacao_MultipleDate_Formats(string dateStr)
    {
        var service = new NormalizacaoService(CreateLogger<NormalizacaoService>());
        var rawList = new List<RawTransacaoImportada>
        {
            new()
            {
                IndiceOriginal = 0,
                DataRaw = dateStr,
                DescricaoRaw = "TEST",
                ValorRaw = "100,00"
            }
        };

        var result = service.Normalizar(rawList);
        Assert.Single(result);
        Assert.Equal(2024, result[0].Data.Year);
        Assert.Equal(1, result[0].Data.Month);
        Assert.Equal(1, result[0].Data.Day);
    }

    [Theory]
    [InlineData("-150,50", 150.50, TipoTransacao.Debito)]
    [InlineData("R$ 150,50", 150.50, TipoTransacao.Indefinido)]
    [InlineData("1.500,00", 1500.00, TipoTransacao.Indefinido)]
    [InlineData("-1.500,00", 1500.00, TipoTransacao.Debito)]
    [InlineData("150.50", 150.50, TipoTransacao.Indefinido)]
    [InlineData("R$ -89,90", 89.90, TipoTransacao.Debito)]
    public void Normalizacao_Valor_ParsesCorrectly(string valorRaw, decimal expectedAbs, TipoTransacao expectedTipo)
    {
        var service = new NormalizacaoService(CreateLogger<NormalizacaoService>());
        var rawList = new List<RawTransacaoImportada>
        {
            new()
            {
                IndiceOriginal = 0,
                DataRaw = "01/01/2024",
                DescricaoRaw = "TEST",
                ValorRaw = valorRaw
            }
        };

        var result = service.Normalizar(rawList);
        Assert.Single(result);
        Assert.Equal(expectedAbs, Math.Abs(result[0].Valor));
        Assert.Equal(expectedTipo, result[0].TipoTransacao);
    }

    [Theory]
    [InlineData("PAGAMENTO FATURA", "pagamento")]
    [InlineData("ESTORNO COMPRA ABC", "estorno")]
    [InlineData("IOF TRANSACAO", "iof")]
    [InlineData("TARIFA BANCARIA", "tarifa")]
    public void Normalizacao_FlagDetection(string descricao, string expectedFlag)
    {
        var service = new NormalizacaoService(CreateLogger<NormalizacaoService>());
        var rawList = new List<RawTransacaoImportada>
        {
            new()
            {
                IndiceOriginal = 0,
                DataRaw = "01/01/2024",
                DescricaoRaw = descricao,
                ValorRaw = "-100,00"
            }
        };

        var result = service.Normalizar(rawList);
        Assert.Single(result);
        Assert.Contains(expectedFlag, result[0].Flags);
    }

    [Fact]
    public void Normalizacao_InternalDedup_RemovesDuplicates()
    {
        var service = new NormalizacaoService(CreateLogger<NormalizacaoService>());
        var rawList = new List<RawTransacaoImportada>
        {
            new() { IndiceOriginal = 0, DataRaw = "01/01/2024", DescricaoRaw = "COMPRA ABC", ValorRaw = "-100,00" },
            new() { IndiceOriginal = 1, DataRaw = "01/01/2024", DescricaoRaw = "COMPRA ABC", ValorRaw = "-100,00" },
        };

        var result = service.Normalizar(rawList);
        // Exact duplicates are removed
        Assert.Single(result);
    }

    [Fact]
    public void Normalizacao_InternalDedup_KeepsDifferentTransactions()
    {
        var service = new NormalizacaoService(CreateLogger<NormalizacaoService>());
        var rawList = new List<RawTransacaoImportada>
        {
            new() { IndiceOriginal = 0, DataRaw = "01/01/2024", DescricaoRaw = "COMPRA ABC", ValorRaw = "-100,00" },
            new() { IndiceOriginal = 1, DataRaw = "01/01/2024", DescricaoRaw = "COMPRA DEF", ValorRaw = "-200,00" },
        };

        var result = service.Normalizar(rawList);
        Assert.Equal(2, result.Count);
    }

    [Theory]
    [InlineData("AMAZON 3/10", 3, 10, "AMAZON")]
    [InlineData("PARCELA 03/10 AMAZON", 3, 10, "AMAZON")]
    [InlineData("PARC 2 DE 12 NETFLIX", 2, 12, "NETFLIX")]
    [InlineData("MAGAZINELUIZA PARC 1/6", 1, 6, "MAGAZINELUIZA")]
    [InlineData("MERCADOLIVRE 5/5", 5, 5, "MERCADOLIVRE")]
    [InlineData("SEM PARCELA AQUI", null, null, "SEM PARCELA AQUI")]
    [InlineData("COMPRA SIMPLES", null, null, "COMPRA SIMPLES")]
    public void Normalizacao_ExtrairParcela_DetectsInstallments(
        string descricao, int? expectedNum, int? expectedTot, string expectedDesc)
    {
        var (num, tot, desc) = NormalizacaoService.ExtrairParcela(descricao);

        Assert.Equal(expectedNum, num);
        Assert.Equal(expectedTot, tot);
        Assert.Equal(expectedDesc, desc);
    }

    [Fact]
    public void Normalizacao_ExtrairParcela_InvalidRange_Ignored()
    {
        // num > tot → invalid, should not parse
        var (num, _, _) = NormalizacaoService.ExtrairParcela("TESTE 5/3");
        Assert.Null(num);
    }

    [Fact]
    public void Normalizacao_Normalizar_ExtractsParcelaFromDescription()
    {
        var service = new NormalizacaoService(CreateLogger<NormalizacaoService>());
        var rawList = new List<RawTransacaoImportada>
        {
            new()
            {
                IndiceOriginal = 0,
                DataRaw = "15/02/2024",
                DescricaoRaw = "AMAZON 3/10",
                ValorRaw = "-99,90"
            }
        };

        var result = service.Normalizar(rawList);

        Assert.Single(result);
        Assert.Equal(3, result[0].NumeroParcela);
        Assert.Equal(10, result[0].TotalParcelas);
        Assert.Equal("AMAZON", result[0].Descricao);
    }

    #endregion

    #region BancoProfileDetector

    [Fact]
    public void BancoProfileDetector_Nubank_DetectedByHeader()
    {
        var detector = new BancoProfileDetector(CreateLogger<BancoProfileDetector>());
        var headers = new[] { "Date", "Title", "Amount" };

        var profile = detector.Detectar(headers, Array.Empty<string>());

        Assert.NotNull(profile);
        Assert.Equal("Nubank", profile.NomeBanco);
    }

    [Fact]
    public void BancoProfileDetector_WithExplicitBanco_ReturnsMatch()
    {
        var detector = new BancoProfileDetector(CreateLogger<BancoProfileDetector>());
        var headers = new[] { "Data", "Descrição", "Valor" };

        var profile = detector.Detectar(headers, Array.Empty<string>(), "nubank");

        Assert.NotNull(profile);
        Assert.Equal("Nubank", profile.NomeBanco);
    }

    [Fact]
    public void BancoProfileDetector_UnknownHeaders_FallsBackToHeuristic()
    {
        var detector = new BancoProfileDetector(CreateLogger<BancoProfileDetector>());
        var headers = new[] { "Transaction Date", "Details", "Amount" };

        var profile = detector.Detectar(headers, Array.Empty<string>());

        Assert.NotNull(profile);
    }

    #endregion

    #region CategorizadorImportacaoService

    [Fact]
    public async Task Categorizador_UserRules_AppliedFirst()
    {
        // Arrange
        var regrasRepo = new Mock<IRegraCategorizacaoRepository>();
        regrasRepo.Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>())).ReturnsAsync(new List<RegraCategorizacao>
        {
            new() { Padrao = "UBER*", CategoriaId = 5, Prioridade = 10, Ativo = true }
        });

        var mapeamentoRepo = new Mock<IMapeamentoCategorizacaoRepository>();
        mapeamentoRepo.Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>())).ReturnsAsync(new List<MapeamentoCategorizacao>());

        var categoriaRepo = new Mock<ICategoriaRepository>();
        categoriaRepo.Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>())).ReturnsAsync(new List<Categoria>
        {
            new() { Id = 5, Nome = "Transporte" }
        });

        var aiService = new Mock<IAiService>();
        var logger = CreateLogger<CategorizadorImportacaoService>();
        var service = new CategorizadorImportacaoService(regrasRepo.Object, mapeamentoRepo.Object, categoriaRepo.Object, aiService.Object, logger);

        var transacoes = new List<TransacaoNormalizada>
        {
            new() { IndiceOriginal = 0, Data = DateTime.UtcNow, Descricao = "UBER TRIP SAO PAULO", DescricaoOriginal = "UBER TRIP SAO PAULO", Valor = -25m, TipoTransacao = TipoTransacao.Debito, Valida = true, Flags = new() }
        };

        // Act
        var result = await service.CategorizarAsync(1, transacoes);

        // Assert
        Assert.Single(result);
        Assert.Equal(5, result[0].CategoriaId);
        Assert.Equal("Transporte", result[0].CategoriaSugerida);
    }

    [Fact]
    public async Task Categorizador_LearnedMappings_AppliedSecond()
    {
        var regrasRepo = new Mock<IRegraCategorizacaoRepository>();
        regrasRepo.Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>())).ReturnsAsync(new List<RegraCategorizacao>());

        var mapeamentoRepo = new Mock<IMapeamentoCategorizacaoRepository>();
        mapeamentoRepo.Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>())).ReturnsAsync(new List<MapeamentoCategorizacao>
        {
            new() { DescricaoNormalizada = "PADARIA DO JOAO", CategoriaId = 3, Contagem = 5 }
        });

        var categoriaRepo = new Mock<ICategoriaRepository>();
        categoriaRepo.Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>())).ReturnsAsync(new List<Categoria>
        {
            new() { Id = 3, Nome = "Alimentação" }
        });

        var aiService = new Mock<IAiService>();
        var logger = CreateLogger<CategorizadorImportacaoService>();
        var service = new CategorizadorImportacaoService(regrasRepo.Object, mapeamentoRepo.Object, categoriaRepo.Object, aiService.Object, logger);

        var transacoes = new List<TransacaoNormalizada>
        {
            new() { IndiceOriginal = 0, Data = DateTime.UtcNow, Descricao = "PADARIA DO JOAO", DescricaoOriginal = "Padaria do João", Valor = -15m, TipoTransacao = TipoTransacao.Debito, Valida = true, Flags = new() }
        };

        var result = await service.CategorizarAsync(1, transacoes);

        Assert.Single(result);
        Assert.Equal(3, result[0].CategoriaId);
        Assert.Equal("Alimentação", result[0].CategoriaSugerida);
    }

    [Fact]
    public async Task Categorizador_SalvarAprendizado_CreatesMappings()
    {
        var regrasRepo = new Mock<IRegraCategorizacaoRepository>();
        var mapeamentoRepo = new Mock<IMapeamentoCategorizacaoRepository>();
        mapeamentoRepo.Setup(r => r.ObterPorDescricaoAsync(It.IsAny<int>(), It.IsAny<string>())).ReturnsAsync((MapeamentoCategorizacao?)null);

        var categoriaRepo = new Mock<ICategoriaRepository>();
        var aiService = new Mock<IAiService>();
        var logger = CreateLogger<CategorizadorImportacaoService>();
        var service = new CategorizadorImportacaoService(regrasRepo.Object, mapeamentoRepo.Object, categoriaRepo.Object, aiService.Object, logger);

        var overrides = new List<TransacaoOverrideDto>
        {
            new() { IndiceOriginal = 0, Descricao = "COMPRA FARMACIA", CategoriaId = 7 }
        };

        await service.SalvarAprendizadoAsync(1, overrides);

        mapeamentoRepo.Verify(r => r.CriarAsync(It.Is<MapeamentoCategorizacao>(
            m => m.UsuarioId == 1 && m.CategoriaId == 7 && m.Contagem == 1
        )), Times.Once);
    }

    [Theory]
    [InlineData("VIARONDON LINS BRA", "Transporte")]
    [InlineData("RAIA261 PENAPOLIS BRA", "Saúde")]
    [InlineData("LS COMERCIO DE BEBIDA BIRIGUI BRA", "Alimentação")]
    [InlineData("KOTAS SERVICOS DE INTERNET", "Moradia")]
    [InlineData("OTICA MEIRELLES LTDA", "Saúde")]
    [InlineData("CUPONOMIA DIVULGACAO VIRTUAL LTDA", null)] // Sem keyword match
    [InlineData("SUZILEINE MARIA SUSSAI", null)] // Nome de pessoa, sem match
    public async Task Categorizador_Keywords_MatchesPicPayDescriptions(string descricao, string? expectedCategoria)
    {
        var regrasRepo = new Mock<IRegraCategorizacaoRepository>();
        regrasRepo.Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>())).ReturnsAsync(new List<RegraCategorizacao>());
        var mapeamentoRepo = new Mock<IMapeamentoCategorizacaoRepository>();
        mapeamentoRepo.Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>())).ReturnsAsync(new List<MapeamentoCategorizacao>());

        var categoriaRepo = new Mock<ICategoriaRepository>();
        categoriaRepo.Setup(r => r.ObterPorUsuarioAsync(It.IsAny<int>())).ReturnsAsync(new List<Categoria>
        {
            new() { Id = 1, Nome = "Alimentação" },
            new() { Id = 2, Nome = "Transporte" },
            new() { Id = 3, Nome = "Moradia" },
            new() { Id = 4, Nome = "Saúde" },
            new() { Id = 5, Nome = "Lazer" },
            new() { Id = 6, Nome = "Educação" },
            new() { Id = 7, Nome = "Vestuário" },
            new() { Id = 8, Nome = "Assinaturas" },
            new() { Id = 9, Nome = "Outros" },
        });

        var aiService = new Mock<IAiService>();
        var logger = CreateLogger<CategorizadorImportacaoService>();
        var service = new CategorizadorImportacaoService(regrasRepo.Object, mapeamentoRepo.Object, categoriaRepo.Object, aiService.Object, logger);

        var transacoes = new List<TransacaoNormalizada>
        {
            new() { IndiceOriginal = 0, Data = DateTime.UtcNow, Descricao = descricao, DescricaoOriginal = descricao, Valor = -10m, TipoTransacao = TipoTransacao.Debito, Valida = true, Flags = new() }
        };

        var result = await service.CategorizarAsync(1, transacoes);

        Assert.Single(result);
        if (expectedCategoria != null)
        {
            Assert.Equal(expectedCategoria, result[0].CategoriaSugerida);
            Assert.NotNull(result[0].CategoriaId);
        }
        else
        {
            // Without AI, should fallback to no category (AI mock doesn't respond)
            Assert.True(result[0].CategoriaId == null || result[0].CategoriaSugerida != "Outros",
                $"Expected no keyword match for '{descricao}' but got '{result[0].CategoriaSugerida}'");
        }
    }

    #endregion

    #region ImportacaoService — Hash / Idempotency

    [Fact]
    public async Task ImportacaoService_HashCalculation_Deterministic()
    {
        var content = "test file content 12345";
        using var stream1 = ToStream(content);
        using var stream2 = ToStream(content);

        var hash1 = await ImportacaoService.CalcularHashAsync(stream1);
        var hash2 = await ImportacaoService.CalcularHashAsync(stream2);

        Assert.Equal(hash1, hash2);
        Assert.Equal(64, hash1.Length); // SHA256 = 64 hex chars
    }

    [Fact]
    public async Task ImportacaoService_DifferentContent_DifferentHash()
    {
        using var stream1 = ToStream("content A");
        using var stream2 = ToStream("content B");

        var hash1 = await ImportacaoService.CalcularHashAsync(stream1);
        var hash2 = await ImportacaoService.CalcularHashAsync(stream2);

        Assert.NotEqual(hash1, hash2);
    }

    #endregion

    #region ImportacaoService — Format Detection

    [Theory]
    [InlineData("extrato.csv", FormatoArquivo.CSV)]
    [InlineData("FATURA.OFX", FormatoArquivo.OFX)]
    [InlineData("statement.xlsx", FormatoArquivo.XLSX)]
    [InlineData("fatura.pdf", FormatoArquivo.PDF)]
    [InlineData("data.xls", FormatoArquivo.XLSX)]
    [InlineData("export.qfx", FormatoArquivo.OFX)]
    public void ImportacaoService_DetectarFormato_CorrectMapping(string filename, FormatoArquivo expected)
    {
        var result = ImportacaoService.DetectarFormato(filename);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void ImportacaoService_DetectarFormato_UnsupportedThrows()
    {
        Assert.Throws<ArgumentException>(() => ImportacaoService.DetectarFormato("file.docx"));
    }

    #endregion

    #region OFX Parser

    [Fact]
    public async Task OfxParser_XmlFormat_ParsesCorrectly()
    {
        var parser = CreateOfxParser();
        var ofx = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <FI><ORG>Nubank</ORG></FI>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20240101120000</DTPOSTED>
            <TRNAMT>-150.00</TRNAMT>
            <MEMO>COMPRA SUPERMERCADO</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20240102120000</DTPOSTED>
            <TRNAMT>500.00</TRNAMT>
            <MEMO>PIX RECEBIDO</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>";
        using var stream = ToStream(ofx);

        var result = await parser.ParseAsync(stream, "extrato.ofx", null);

        Assert.True(result.Sucesso);
        Assert.Equal(2, result.Transacoes.Count);
        Assert.Equal("-150.00", result.Transacoes[0].ValorRaw);
        Assert.Equal("COMPRA SUPERMERCADO", result.Transacoes[0].DescricaoRaw);
        Assert.Equal("Nubank", result.BancoDetectado);
    }

    [Fact]
    public async Task OfxParser_SgmlFormat_ParsesCorrectly()
    {
        var parser = CreateOfxParser();
        var ofx = @"OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<FI>
<ORG>Banco do Brasil
</FI>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>-200.00
<MEMO>TAR MANUT CONTA
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>";
        using var stream = ToStream(ofx);

        var result = await parser.ParseAsync(stream, "bb.ofx", null);

        Assert.True(result.Sucesso);
        Assert.Single(result.Transacoes);
        Assert.Equal("-200.00", result.Transacoes[0].ValorRaw);
    }

    #endregion

    #region Helpers

    private static MemoryStream ToStream(string content)
    {
        return new MemoryStream(Encoding.UTF8.GetBytes(content));
    }

    private static ILogger<T> CreateLogger<T>()
    {
        return new Mock<ILogger<T>>().Object;
    }

    private static CsvFileParser CreateCsvParser()
    {
        return new CsvFileParser(
            new BancoProfileDetector(CreateLogger<BancoProfileDetector>()),
            CreateLogger<CsvFileParser>());
    }

    private static OfxFileParser CreateOfxParser()
    {
        return new OfxFileParser(new Mock<ILogger<OfxFileParser>>().Object);
    }

    private static PdfFileParser CreatePdfParser()
    {
        return new PdfFileParser(
            new Mock<IAiService>().Object,
            CreateLogger<PdfFileParser>());
    }

    #endregion

    #region PdfFileParser — PicPay Format

    [Fact]
    public void PdfParser_LimparTextoPdf_NormalizesUnicodeMinus()
    {
        // Unicode minus sign U+2212
        var texto = "23:54 Compra realizada \u2212R$ 3,49";
        var limpo = PdfFileParser.LimparTextoPdf(texto);
        Assert.Contains("-R$", limpo);
        Assert.DoesNotContain("\u2212", limpo);
    }

    [Fact]
    public void PdfParser_LimparTextoPdf_NormalizesEnDashEmDash()
    {
        var texto = "valor \u2013R$ 10,00 e \u2014R$ 20,00";
        var limpo = PdfFileParser.LimparTextoPdf(texto);
        Assert.Contains("-R$ 10,00", limpo);
        Assert.Contains("-R$ 20,00", limpo);
    }

    [Fact]
    public void PdfParser_PicPayFormat_ExtractsTransactions()
    {
        var parser = CreatePdfParser();
        var texto = @"Nicolas Portie Sussai Silva | CPF: 479.987.918-96
Agência: 0001 Conta: 45755088-0 | Extrato de conta | Período
Saldo final do período | 31 de janeiro de 2026 a 01 de março de 2026

01 de março 2026 Saldo ao final do dia: R$ 28,05
Hora Tipo Origem / Destino Forma de pagamento Valor
23:54 Compra realizada Raia261 Penapolis Bra Com saldo -R$ 3,49
01:21 Compra realizada Viarondon Lins Bra Com saldo -R$ 10,60
Ls Comercio de Bebida
00:56 Compra realizada Com saldo -R$ 2,50
Birigui Bra

28 de fevereiro 2026 Saldo ao final do dia: R$ 44,64
Hora Tipo Origem / Destino Forma de pagamento Valor
22:09 Dinheiro resgatado +R$ 54,90
10:39 Pix recebido +R$ 30,03

27 de fevereiro 2026 Saldo ao final do dia: R$ 240,29
Hora Tipo Origem / Destino Forma de pagamento Valor
12:13 Pix enviado Suzileine Maria Sussai Com saldo -R$ 410,00
11:31 TED recebido +R$ 3.273,72";

        // Pre-clean (normalization happens in LimparTextoPdf)
        texto = PdfFileParser.LimparTextoPdf(texto);

        var transacoes = parser.ExtrairPorRegex(texto);

        Assert.True(transacoes.Count >= 7, $"Expected at least 7 transactions, got {transacoes.Count}");

        // Check dates
        var marco = transacoes.Where(t => t.DataRaw!.Contains("/03/")).ToList();
        var fev28 = transacoes.Where(t => t.DataRaw!.Contains("28/")).ToList();
        var fev27 = transacoes.Where(t => t.DataRaw!.Contains("27/")).ToList();
        Assert.Equal(3, marco.Count);
        Assert.Equal(2, fev28.Count);
        Assert.Equal(2, fev27.Count);

        // Check first transaction
        var first = transacoes[0];
        Assert.Contains("Compra realizada", first.DescricaoRaw);
        Assert.Contains("Raia261", first.DescricaoRaw);
        Assert.Equal("-3,49", first.ValorRaw);

        // Check transaction with context lines (Ls Comercio de Bebida + Birigui Bra)
        var compra250 = transacoes.FirstOrDefault(t => t.ValorRaw == "-2,50");
        Assert.NotNull(compra250);
        Assert.Contains("Compra realizada", compra250.DescricaoRaw);
        Assert.Contains("Ls Comercio de Bebida", compra250.DescricaoRaw);

        // Check credit transaction (+R$ 54,90) - LimparValorRaw strips the '+'
        var resgate = transacoes.FirstOrDefault(t => t.ValorRaw == "54,90");
        Assert.NotNull(resgate);
        Assert.Contains("Dinheiro resgatado", resgate.DescricaoRaw);

        // Check TED (large positive value)
        var ted = transacoes.FirstOrDefault(t => t.ValorRaw == "3.273,72");
        Assert.NotNull(ted);
        Assert.Contains("TED recebido", ted.DescricaoRaw);
    }

    [Fact]
    public void PdfParser_PicPayFormat_HandlesPaymentMethodRemoval()
    {
        var parser = CreatePdfParser();
        var texto = @"15 de janeiro 2026 Saldo ao final do dia: R$ 100,00
Hora Tipo Origem / Destino Forma de pagamento Valor
11:14 Pagamento realizado PRIMO ROSSI ADMINISTRADORA DE Com saldo -R$ 408,94";

        texto = PdfFileParser.LimparTextoPdf(texto);
        var transacoes = parser.ExtrairPorRegex(texto);

        Assert.Single(transacoes);
        var t = transacoes[0];
        Assert.Contains("Pagamento realizado", t.DescricaoRaw);
        Assert.Contains("PRIMO ROSSI", t.DescricaoRaw);
        // "Com saldo" should be removed
        Assert.DoesNotContain("Com saldo", t.DescricaoRaw);
        Assert.Equal("-408,94", t.ValorRaw);
    }

    [Fact]
    public void PdfParser_PicPayFormat_ContextLinesAssignedToNearestTransaction()
    {
        var parser = CreatePdfParser();
        // Context lines before AND after the transaction
        var texto = @"20 de janeiro 2026 Saldo ao final do dia: R$ 500,00
Hora Tipo Origem / Destino Forma de pagamento Valor
Do cofrinho Cofrinho do
22:09 Dinheiro resgatado +R$ 54,90
Cartão
No cofrinho Cofrinho do
19:16 Dinheiro guardado Com saldo -R$ 1.446,00
Cartão";

        texto = PdfFileParser.LimparTextoPdf(texto);
        var transacoes = parser.ExtrairPorRegex(texto);

        Assert.Equal(2, transacoes.Count);

        // First transaction should have context "Do cofrinho Cofrinho do" and "Cartão"
        var resgate = transacoes.First(t => t.ValorRaw == "54,90");
        Assert.Contains("Dinheiro resgatado", resgate.DescricaoRaw);

        // Second transaction should have context "No cofrinho Cofrinho do" and "Cartão"
        var guardado = transacoes.First(t => t.ValorRaw == "-1.446,00");
        Assert.Contains("Dinheiro guardado", guardado.DescricaoRaw);
    }

    [Fact]
    public void PdfParser_PicPayFormat_NonPicPayTextDoesNotMatch()
    {
        var parser = CreatePdfParser();
        // Standard bank format, not PicPay
        var texto = @"01/01/2024 PIX RECEBIDO FULANO 500,00
02/01/2024 COMPRA DEBITO SUPERMERCADO -89,90";

        texto = PdfFileParser.LimparTextoPdf(texto);
        var transacoes = parser.ExtrairPorRegex(texto);

        // Should be parsed by single-line regex, not PicPay
        Assert.Equal(2, transacoes.Count);
        Assert.Contains("PIX RECEBIDO", transacoes[0].DescricaoRaw);
    }

    [Fact]
    public async Task PdfParser_RealPicPayPdf_ExtractsTransactions()
    {
        var pdfPath = Path.Combine(
            Directory.GetCurrentDirectory(), "..", "..", "..", "..", "..",
            "extrato", "extrato-2026-01-31-2026-03-01.pdf");

        // Skip if real PDF is not available
        if (!File.Exists(pdfPath))
        {
            // Try absolute path
            pdfPath = @"c:\Projetos\ControlFinance\extrato\extrato-2026-01-31-2026-03-01.pdf";
            if (!File.Exists(pdfPath))
                return; // Skip test if file doesn't exist
        }

        var parser = CreatePdfParser();
        using var stream = File.OpenRead(pdfPath);

        var result = await parser.ParseAsync(stream, "extrato-2026-01-31-2026-03-01.pdf", "PicPay");

        Assert.True(result.Sucesso, $"Parse should succeed. Errors: {string.Join("; ", result.Erros)}");
        Assert.True(result.Transacoes.Count >= 10,
            $"Expected at least 10 transactions from 5-page PicPay PDF, got {result.Transacoes.Count}");

        // All transactions should have valid dates
        foreach (var t in result.Transacoes)
        {
            Assert.False(string.IsNullOrWhiteSpace(t.DataRaw), "DataRaw should not be empty");
            Assert.False(string.IsNullOrWhiteSpace(t.DescricaoRaw), "DescricaoRaw should not be empty");
            Assert.False(string.IsNullOrWhiteSpace(t.ValorRaw), "ValorRaw should not be empty");
        }

        // Log all extracted transactions for inspection
        var output = new System.Text.StringBuilder();
        output.AppendLine($"Total: {result.Transacoes.Count} transações");
        foreach (var t in result.Transacoes)
        {
            output.AppendLine($"  [{t.DataRaw}] {t.DescricaoRaw} → {t.ValorRaw}");
        }

        // Output will show in test logs
        Assert.True(true, output.ToString());
    }

    [Fact]
    public void PdfParser_SepararMultiColuna_SplitsDuasTransacoesMesmaLinha()
    {
        // Linha com duas transações lado a lado (PicPay fatura multi-coluna)
        var linhas = new[]
        {
            "08/01  AUTO POSTO CANECO DE O  20,00 15/01  MERCADO*MERCADPARC01/06  34,00"
        };

        var result = PdfFileParser.SepararLinhasMultiColuna(linhas);

        Assert.Equal(2, result.Length);
        Assert.Equal("08/01  AUTO POSTO CANECO DE O  20,00", result[0]);
        Assert.Equal("15/01  MERCADO*MERCADPARC01/06  34,00", result[1]);
    }

    [Fact]
    public void PdfParser_SepararMultiColuna_SplitsTransacaoComCabecalhoAdjacente()
    {
        // Transação seguida de cabeçalho de coluna adjacente
        var linhas = new[]
        {
            "06/01  KAWAKAMI LOJA 11  14,87 Transações Nacionais",
            "07/01  KAWAKAMI LOJA 11  47,24 Data  Estabelecimento  Valor (R$)"
        };

        var result = PdfFileParser.SepararLinhasMultiColuna(linhas);

        Assert.Equal(4, result.Length);
        Assert.Equal("06/01  KAWAKAMI LOJA 11  14,87", result[0]);
        Assert.Equal("07/01  KAWAKAMI LOJA 11  47,24", result[2]);
    }

    [Fact]
    public void PdfParser_SepararMultiColuna_ExtraiTransacaoEmbutidaAposCabecalho()
    {
        // Cabeçalho de seção seguido de transação de outra coluna
        var linhas = new[]
        {
            "Picpay Card final 9066  02/01  MERCADO EXTRA-1875  86,94"
        };

        var result = PdfFileParser.SepararLinhasMultiColuna(linhas);

        Assert.Equal(2, result.Length);
        Assert.Contains("Picpay Card final 9066", result[0]);
        Assert.Equal("02/01  MERCADO EXTRA-1875  86,94", result[1]);
    }

    [Fact]
    public void PdfParser_SepararMultiColuna_NaoQuebraLinhaSimplesNormal()
    {
        // Linha de transação simples (uma coluna) NÃO deve ser quebrada
        var linhas = new[]
        {
            "12/01  PAGAMENTO DE FATURA  3.104,39",
            "16/01  IOF COMPRA INTERNACIONAL  2,24",
            "SALDO ANTERIOR"
        };

        var result = PdfFileParser.SepararLinhasMultiColuna(linhas);

        Assert.Equal(3, result.Length);
        Assert.Equal("12/01  PAGAMENTO DE FATURA  3.104,39", result[0]);
        Assert.Equal("16/01  IOF COMPRA INTERNACIONAL  2,24", result[1]);
        Assert.Equal("SALDO ANTERIOR", result[2]);
    }

    [Fact]
    public void PdfParser_SepararMultiColuna_MultiplasLinhasMultiColuna()
    {
        // Múltiplas linhas com duas colunas, simulando fatura PicPay
        var linhas = new[]
        {
            "08/01  AUTO POSTO  20,00 15/01  MERCADO  34,00",
            "09/01  KAWAKAMI  15,78 16/01  TONELLI  20,00",
            "10/01  GUTIERRES  86,19 17/01  AUTO POSTO 2  20,00",
            "13/01  EBN *TIKTOK  43,65 19/01  AMIGAO  7,99",
        };

        var result = PdfFileParser.SepararLinhasMultiColuna(linhas);

        Assert.Equal(8, result.Length); // 4 linhas × 2 transações cada

        // Verificar que cada par está correto
        Assert.StartsWith("08/01", result[0]);
        Assert.Contains("20,00", result[0]);
        Assert.StartsWith("15/01", result[1]);
        Assert.Contains("34,00", result[1]);
    }

    [Fact]
    public void PdfParser_SepararMultiColuna_IntegracaoComExtrairPorRegex()
    {
        // Teste de integração: linhas multi-coluna devem gerar transações corretas
        var parser = CreatePdfParser();
        var texto = @"08/01  AUTO POSTO CANECO DE O  20,00 15/01  MERCADO*MERCADPARC01/06  34,00
09/01  KAWAKAMI LOJA 11  15,78 16/01  TONELLI MARANGONI AUTO  20,00";

        texto = PdfFileParser.LimparTextoPdf(texto);
        var transacoes = parser.ExtrairPorRegex(texto);

        Assert.Equal(4, transacoes.Count);

        // Primeira transação: coluna esquerda, linha 1
        var t1 = transacoes.FirstOrDefault(t => t.DescricaoRaw.Contains("AUTO POSTO CANECO"));
        Assert.NotNull(t1);
        Assert.Contains("08/01", t1.DataRaw!);
        Assert.Equal("20,00", t1.ValorRaw);

        // Segunda transação: coluna direita, linha 1
        var t2 = transacoes.FirstOrDefault(t => t.DescricaoRaw.Contains("MERCADO*MERCAD"));
        Assert.NotNull(t2);
        Assert.Contains("15/01", t2.DataRaw!);
        Assert.Equal("34,00", t2.ValorRaw);

        // Terceira transação: coluna esquerda, linha 2
        var t3 = transacoes.FirstOrDefault(t => t.DescricaoRaw.Contains("KAWAKAMI"));
        Assert.NotNull(t3);
        Assert.Contains("09/01", t3.DataRaw!);
        Assert.Equal("15,78", t3.ValorRaw);

        // Quarta transação: coluna direita, linha 2
        var t4 = transacoes.FirstOrDefault(t => t.DescricaoRaw.Contains("TONELLI"));
        Assert.NotNull(t4);
        Assert.Contains("16/01", t4.DataRaw!);
        Assert.Equal("20,00", t4.ValorRaw);
    }

    #endregion

    #region MarcarDuplicatasFaturaAsync

    private ImportacaoService CreateImportacaoService(
        Mock<ICartaoCreditoRepository>? cartaoRepo = null,
        Mock<IFaturaRepository>? faturaRepo = null,
        Mock<IParcelaRepository>? parcelaRepo = null)
    {
        return new ImportacaoService(
            parsers: Array.Empty<IFileParser>(),
            normalizacao: new NormalizacaoService(Mock.Of<ILogger<NormalizacaoService>>()),
            categorizador: Mock.Of<ICategorizadorImportacaoService>(),
            historicoService: Mock.Of<IImportacaoHistoricoService>(),
            lancamentoRepo: Mock.Of<ILancamentoRepository>(),
            categoriaRepo: Mock.Of<ICategoriaRepository>(),
            faturaRepo: faturaRepo?.Object ?? Mock.Of<IFaturaRepository>(),
            cartaoRepo: cartaoRepo?.Object ?? Mock.Of<ICartaoCreditoRepository>(),
            parcelaRepo: parcelaRepo?.Object ?? Mock.Of<IParcelaRepository>(),
            unitOfWork: Mock.Of<IUnitOfWork>(),
            cache: new MemoryCache(new MemoryCacheOptions()),
            logger: Mock.Of<ILogger<ImportacaoService>>());
    }

    [Fact]
    public async Task DedupFatura_ParcelaExistente_MarcaDuplicata()
    {
        // Arrange: parcela "TENIS 2/3" já existe na fatura
        var cartaoRepo = new Mock<ICartaoCreditoRepository>();
        cartaoRepo.Setup(r => r.ObterPorIdAsync(1))
            .ReturnsAsync(new CartaoCredito { Id = 1, Nome = "Nubank", DiaFechamento = 5, UsuarioId = 1 });

        var faturaRepo = new Mock<IFaturaRepository>();
        faturaRepo.Setup(r => r.ObterFaturaAbertaAsync(1, It.IsAny<DateTime>()))
            .ReturnsAsync(new Fatura { Id = 10, CartaoCreditoId = 1 });

        var parcelaRepo = new Mock<IParcelaRepository>();
        parcelaRepo.Setup(r => r.ObterPorFaturaAsync(10))
            .ReturnsAsync(new List<Parcela>
            {
                new()
                {
                    Id = 100, NumeroParcela = 2, TotalParcelas = 3, Valor = 150.00m,
                    LancamentoId = 50,
                    Lancamento = new Lancamento { Id = 50, Descricao = "Tenis Nike", Valor = 150.00m }
                }
            });

        var service = CreateImportacaoService(cartaoRepo, faturaRepo, parcelaRepo);

        var transacoes = new List<TransacaoImportadaDto>
        {
            new()
            {
                IndiceOriginal = 0, Data = new DateTime(2025, 6, 10),
                Descricao = "TENIS NIKE", Valor = -150.00m,
                NumeroParcela = 2, TotalParcelas = 3, Selecionada = true,
                Status = StatusTransacaoImportada.Normal
            }
        };
        var normalizadas = new List<TransacaoNormalizada>
        {
            new() { IndiceOriginal = 0, Descricao = "TENIS NIKE", Valida = true }
        };

        // Act
        await service.MarcarDuplicatasFaturaAsync(1, transacoes, normalizadas);

        // Assert
        Assert.Equal(StatusTransacaoImportada.Duplicata, transacoes[0].Status);
        Assert.Contains("fatura", transacoes[0].MotivoStatus!);
        Assert.False(transacoes[0].Selecionada);
        Assert.Contains(50, transacoes[0].LancamentosSimilaresIds);
    }

    [Fact]
    public async Task DedupFatura_ParcelaDiferente_NaoMarcaDuplicata()
    {
        // Arrange: parcela 1/3 existe, mas importando 2/3 com descrição diferente
        var cartaoRepo = new Mock<ICartaoCreditoRepository>();
        cartaoRepo.Setup(r => r.ObterPorIdAsync(1))
            .ReturnsAsync(new CartaoCredito { Id = 1, Nome = "Nubank", DiaFechamento = 5, UsuarioId = 1 });

        var faturaRepo = new Mock<IFaturaRepository>();
        faturaRepo.Setup(r => r.ObterFaturaAbertaAsync(1, It.IsAny<DateTime>()))
            .ReturnsAsync(new Fatura { Id = 10, CartaoCreditoId = 1 });

        var parcelaRepo = new Mock<IParcelaRepository>();
        parcelaRepo.Setup(r => r.ObterPorFaturaAsync(10))
            .ReturnsAsync(new List<Parcela>
            {
                new()
                {
                    Id = 100, NumeroParcela = 1, TotalParcelas = 3, Valor = 150.00m,
                    LancamentoId = 50,
                    Lancamento = new Lancamento { Id = 50, Descricao = "Outro Produto", Valor = 150.00m }
                }
            });

        var service = CreateImportacaoService(cartaoRepo, faturaRepo, parcelaRepo);

        var transacoes = new List<TransacaoImportadaDto>
        {
            new()
            {
                IndiceOriginal = 0, Data = new DateTime(2025, 6, 10),
                Descricao = "AMAZON LIVRO", Valor = -150.00m,
                NumeroParcela = 2, TotalParcelas = 3, Selecionada = true,
                Status = StatusTransacaoImportada.Normal
            }
        };
        var normalizadas = new List<TransacaoNormalizada>
        {
            new() { IndiceOriginal = 0, Descricao = "AMAZON LIVRO", Valida = true }
        };

        // Act
        await service.MarcarDuplicatasFaturaAsync(1, transacoes, normalizadas);

        // Assert: descrição diferente, não é duplicata
        Assert.Equal(StatusTransacaoImportada.Normal, transacoes[0].Status);
        Assert.True(transacoes[0].Selecionada);
    }

    [Fact]
    public async Task DedupFatura_SemFaturaExistente_NaoMarcaDuplicata()
    {
        // Arrange: nenhuma fatura existe para o mês
        var cartaoRepo = new Mock<ICartaoCreditoRepository>();
        cartaoRepo.Setup(r => r.ObterPorIdAsync(1))
            .ReturnsAsync(new CartaoCredito { Id = 1, Nome = "Nubank", DiaFechamento = 5, UsuarioId = 1 });

        var faturaRepo = new Mock<IFaturaRepository>();
        faturaRepo.Setup(r => r.ObterFaturaAbertaAsync(1, It.IsAny<DateTime>()))
            .ReturnsAsync((Fatura?)null);

        var service = CreateImportacaoService(cartaoRepo, faturaRepo);

        var transacoes = new List<TransacaoImportadaDto>
        {
            new()
            {
                IndiceOriginal = 0, Data = new DateTime(2025, 6, 10),
                Descricao = "TENIS NIKE", Valor = -150.00m,
                NumeroParcela = 2, TotalParcelas = 3, Selecionada = true,
                Status = StatusTransacaoImportada.Normal
            }
        };
        var normalizadas = new List<TransacaoNormalizada>
        {
            new() { IndiceOriginal = 0, Descricao = "TENIS NIKE", Valida = true }
        };

        // Act
        await service.MarcarDuplicatasFaturaAsync(1, transacoes, normalizadas);

        // Assert: sem fatura = sem duplicata
        Assert.Equal(StatusTransacaoImportada.Normal, transacoes[0].Status);
    }

    [Fact]
    public async Task DedupFatura_JaMarcadaDuplicataPorLancamento_NaoReavalia()
    {
        // Arrange: transação já marcada como duplicata pelo dedup de lançamentos
        var cartaoRepo = new Mock<ICartaoCreditoRepository>();
        cartaoRepo.Setup(r => r.ObterPorIdAsync(1))
            .ReturnsAsync(new CartaoCredito { Id = 1, Nome = "Nubank", DiaFechamento = 5, UsuarioId = 1 });

        var service = CreateImportacaoService(cartaoRepo);

        var transacoes = new List<TransacaoImportadaDto>
        {
            new()
            {
                IndiceOriginal = 0, Data = new DateTime(2025, 6, 10),
                Descricao = "TENIS NIKE", Valor = -150.00m,
                Status = StatusTransacaoImportada.Duplicata, // já marcada
                MotivoStatus = "Possível duplicata de lançamento(s) existente(s)",
                Selecionada = false
            }
        };
        var normalizadas = new List<TransacaoNormalizada>
        {
            new() { IndiceOriginal = 0, Descricao = "TENIS NIKE", Valida = true }
        };

        // Act
        await service.MarcarDuplicatasFaturaAsync(1, transacoes, normalizadas);

        // Assert: mantém status original, não reavaliou
        Assert.Equal("Possível duplicata de lançamento(s) existente(s)", transacoes[0].MotivoStatus);
    }

    [Fact]
    public async Task DedupFatura_ValorDiferente_NaoMarcaDuplicata()
    {
        // Arrange: mesma descrição mas valor diferente
        var cartaoRepo = new Mock<ICartaoCreditoRepository>();
        cartaoRepo.Setup(r => r.ObterPorIdAsync(1))
            .ReturnsAsync(new CartaoCredito { Id = 1, Nome = "Nubank", DiaFechamento = 5, UsuarioId = 1 });

        var faturaRepo = new Mock<IFaturaRepository>();
        faturaRepo.Setup(r => r.ObterFaturaAbertaAsync(1, It.IsAny<DateTime>()))
            .ReturnsAsync(new Fatura { Id = 10, CartaoCreditoId = 1 });

        var parcelaRepo = new Mock<IParcelaRepository>();
        parcelaRepo.Setup(r => r.ObterPorFaturaAsync(10))
            .ReturnsAsync(new List<Parcela>
            {
                new()
                {
                    Id = 100, NumeroParcela = 2, TotalParcelas = 3, Valor = 200.00m,
                    LancamentoId = 50,
                    Lancamento = new Lancamento { Id = 50, Descricao = "Tenis Nike", Valor = 200.00m }
                }
            });

        var service = CreateImportacaoService(cartaoRepo, faturaRepo, parcelaRepo);

        var transacoes = new List<TransacaoImportadaDto>
        {
            new()
            {
                IndiceOriginal = 0, Data = new DateTime(2025, 6, 10),
                Descricao = "TENIS NIKE", Valor = -150.00m,
                NumeroParcela = 2, TotalParcelas = 3, Selecionada = true,
                Status = StatusTransacaoImportada.Normal
            }
        };
        var normalizadas = new List<TransacaoNormalizada>
        {
            new() { IndiceOriginal = 0, Descricao = "TENIS NIKE", Valida = true }
        };

        // Act
        await service.MarcarDuplicatasFaturaAsync(1, transacoes, normalizadas);

        // Assert: valor diferente (200 vs 150), não é duplicata
        Assert.Equal(StatusTransacaoImportada.Normal, transacoes[0].Status);
    }

    [Fact]
    public async Task DedupFatura_SemParcela_MatchPorDescricaoEValor()
    {
        // Arrange: compra sem parcela (compra única no cartão) já existe na fatura
        var cartaoRepo = new Mock<ICartaoCreditoRepository>();
        cartaoRepo.Setup(r => r.ObterPorIdAsync(1))
            .ReturnsAsync(new CartaoCredito { Id = 1, Nome = "Nubank", DiaFechamento = 5, UsuarioId = 1 });

        var faturaRepo = new Mock<IFaturaRepository>();
        faturaRepo.Setup(r => r.ObterFaturaAbertaAsync(1, It.IsAny<DateTime>()))
            .ReturnsAsync(new Fatura { Id = 10, CartaoCreditoId = 1 });

        var parcelaRepo = new Mock<IParcelaRepository>();
        parcelaRepo.Setup(r => r.ObterPorFaturaAsync(10))
            .ReturnsAsync(new List<Parcela>
            {
                new()
                {
                    Id = 100, NumeroParcela = 1, TotalParcelas = 1, Valor = 89.90m,
                    LancamentoId = 50,
                    Lancamento = new Lancamento { Id = 50, Descricao = "Restaurante Japa", Valor = 89.90m }
                }
            });

        var service = CreateImportacaoService(cartaoRepo, faturaRepo, parcelaRepo);

        var transacoes = new List<TransacaoImportadaDto>
        {
            new()
            {
                IndiceOriginal = 0, Data = new DateTime(2025, 6, 10),
                Descricao = "RESTAURANTE JAPA", Valor = -89.90m,
                NumeroParcela = null, TotalParcelas = null, Selecionada = true,
                Status = StatusTransacaoImportada.Normal
            }
        };
        var normalizadas = new List<TransacaoNormalizada>
        {
            new() { IndiceOriginal = 0, Descricao = "RESTAURANTE JAPA", Valida = true }
        };

        // Act
        await service.MarcarDuplicatasFaturaAsync(1, transacoes, normalizadas);

        // Assert: compra avulsa também detecta duplicata por valor + descrição
        Assert.Equal(StatusTransacaoImportada.Duplicata, transacoes[0].Status);
        Assert.Contains("fatura", transacoes[0].MotivoStatus!);
    }

    #endregion

    #region ConfirmarImportacaoAsync — Proteção Duplicatas

    [Fact]
    public async Task Confirmar_SkipsDuplicatas_NaoCriaLancamento()
    {
        // Arrange: preview com 2 transações, uma delas marcada como Duplicata
        var cache = new MemoryCache(new MemoryCacheOptions());
        var lancamentoRepo = new Mock<ILancamentoRepository>();
        var categoriaRepo = new Mock<ICategoriaRepository>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var historicoService = new Mock<IImportacaoHistoricoService>();

        categoriaRepo.Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new List<Categoria>
            {
                new() { Id = 1, Nome = "Outras", Padrao = true, UsuarioId = 1 }
            });

        lancamentoRepo.Setup(r => r.CriarAsync(It.IsAny<Lancamento>()))
            .ReturnsAsync((Lancamento l) => { l.Id = 999; return l; });

        unitOfWork.Setup(u => u.BeginTransactionAsync()).Returns(Task.CompletedTask);
        unitOfWork.Setup(u => u.CommitAsync()).Returns(Task.CompletedTask);
        historicoService.Setup(h => h.AtualizarStatusAsync(It.IsAny<int>(), It.IsAny<StatusImportacao>(), It.IsAny<int>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var service = new ImportacaoService(
            parsers: Array.Empty<IFileParser>(),
            normalizacao: new NormalizacaoService(Mock.Of<ILogger<NormalizacaoService>>()),
            categorizador: Mock.Of<ICategorizadorImportacaoService>(),
            historicoService: historicoService.Object,
            lancamentoRepo: lancamentoRepo.Object,
            categoriaRepo: categoriaRepo.Object,
            faturaRepo: Mock.Of<IFaturaRepository>(),
            cartaoRepo: Mock.Of<ICartaoCreditoRepository>(),
            parcelaRepo: Mock.Of<IParcelaRepository>(),
            unitOfWork: unitOfWork.Object,
            cache: cache,
            logger: Mock.Of<ILogger<ImportacaoService>>());

        var preview = new ImportacaoPreviewDto
        {
            Transacoes = new List<TransacaoImportadaDto>
            {
                new()
                {
                    IndiceOriginal = 0, Data = new DateTime(2025, 6, 10),
                    Descricao = "TENIS NIKE", Valor = -150.00m,
                    Status = StatusTransacaoImportada.Duplicata,
                    MotivoStatus = "Parcela já existe na fatura do cartão",
                    Selecionada = false, CategoriaId = 1
                },
                new()
                {
                    IndiceOriginal = 1, Data = new DateTime(2025, 6, 11),
                    Descricao = "SUPERMERCADO", Valor = -89.90m,
                    Status = StatusTransacaoImportada.Normal,
                    Selecionada = true, CategoriaId = 1
                }
            },
            TipoImportacao = TipoImportacao.Extrato
        };

        // Colocar preview no cache
        cache.Set("importacao_preview_1_42", preview, TimeSpan.FromMinutes(30));

        var request = new ConfirmarImportacaoRequest
        {
            ImportacaoHistoricoId = 42,
            // Frontend envia AMBOS os índices (simulando frontend sem proteção)
            IndicesSelecionados = new List<int> { 0, 1 },
            Overrides = new List<TransacaoOverrideDto>()
        };

        // Act
        var resultado = await service.ConfirmarImportacaoAsync(1, request);

        // Assert: só 1 lançamento criado (a duplicata foi pulada)
        Assert.Equal(1, resultado.TotalImportadas);
        Assert.Equal(1, resultado.TotalIgnoradas);
        lancamentoRepo.Verify(r => r.CriarAsync(It.IsAny<Lancamento>()), Times.Once);
    }

    [Fact]
    public async Task Confirmar_SkipsIgnoradas_NaoCriaLancamento()
    {
        // Arrange: transação com status Ignorada
        var cache = new MemoryCache(new MemoryCacheOptions());
        var lancamentoRepo = new Mock<ILancamentoRepository>();
        var categoriaRepo = new Mock<ICategoriaRepository>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var historicoService = new Mock<IImportacaoHistoricoService>();

        categoriaRepo.Setup(r => r.ObterPorUsuarioAsync(1))
            .ReturnsAsync(new List<Categoria>
            {
                new() { Id = 1, Nome = "Outras", Padrao = true, UsuarioId = 1 }
            });

        unitOfWork.Setup(u => u.BeginTransactionAsync()).Returns(Task.CompletedTask);
        unitOfWork.Setup(u => u.CommitAsync()).Returns(Task.CompletedTask);
        historicoService.Setup(h => h.AtualizarStatusAsync(It.IsAny<int>(), It.IsAny<StatusImportacao>(), It.IsAny<int>(), It.IsAny<string?>()))
            .Returns(Task.CompletedTask);

        var service = new ImportacaoService(
            parsers: Array.Empty<IFileParser>(),
            normalizacao: new NormalizacaoService(Mock.Of<ILogger<NormalizacaoService>>()),
            categorizador: Mock.Of<ICategorizadorImportacaoService>(),
            historicoService: historicoService.Object,
            lancamentoRepo: lancamentoRepo.Object,
            categoriaRepo: categoriaRepo.Object,
            faturaRepo: Mock.Of<IFaturaRepository>(),
            cartaoRepo: Mock.Of<ICartaoCreditoRepository>(),
            parcelaRepo: Mock.Of<IParcelaRepository>(),
            unitOfWork: unitOfWork.Object,
            cache: cache,
            logger: Mock.Of<ILogger<ImportacaoService>>());

        var preview = new ImportacaoPreviewDto
        {
            Transacoes = new List<TransacaoImportadaDto>
            {
                new()
                {
                    IndiceOriginal = 0, Data = new DateTime(2025, 6, 10),
                    Descricao = "PAGAMENTO FATURA", Valor = -500.00m,
                    Status = StatusTransacaoImportada.Ignorada,
                    MotivoStatus = "Pagamento de fatura",
                    Selecionada = false, CategoriaId = 1
                }
            },
            TipoImportacao = TipoImportacao.Extrato
        };

        cache.Set("importacao_preview_1_43", preview, TimeSpan.FromMinutes(30));

        var request = new ConfirmarImportacaoRequest
        {
            ImportacaoHistoricoId = 43,
            IndicesSelecionados = new List<int> { 0 },
            Overrides = new List<TransacaoOverrideDto>()
        };

        // Act
        var resultado = await service.ConfirmarImportacaoAsync(1, request);

        // Assert: nenhum lançamento criado
        Assert.Equal(0, resultado.TotalImportadas);
        Assert.Equal(1, resultado.TotalIgnoradas);
        lancamentoRepo.Verify(r => r.CriarAsync(It.IsAny<Lancamento>()), Times.Never);
    }

    #endregion
}
