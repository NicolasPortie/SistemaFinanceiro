using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ControlFinance.Application.Services.Importacao.Parsers;
using Microsoft.Extensions.Logging;
using Moq;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

var pdfPath = @"c:\Projetos\ControlFinance\extrato\extrato-2026-01-31-2026-03-01.pdf";

// Use the actual PdfFileParser to test parsing
var mockAi = new Mock<ControlFinance.Domain.Interfaces.IAiService>();
var mockLogger = new Mock<ILogger<PdfFileParser>>();
var parser = new PdfFileParser(mockAi.Object, mockLogger.Object);

using var stream = File.OpenRead(pdfPath);
var result = await parser.ParseAsync(stream, "extrato-2026-01-31-2026-03-01.pdf", "PicPay");

Console.OutputEncoding = System.Text.Encoding.UTF8;
Console.WriteLine($"Sucesso: {result.Sucesso}");
Console.WriteLine($"Banco: {result.BancoDetectado}");
Console.WriteLine($"Total transações: {result.Transacoes.Count}");
Console.WriteLine($"Avisos: {string.Join("; ", result.Avisos)}");
Console.WriteLine($"Erros: {string.Join("; ", result.Erros)}");
Console.WriteLine();

foreach (var t in result.Transacoes)
{
    Console.WriteLine($"  [{t.DataRaw}] {t.DescricaoRaw} → {t.ValorRaw}");
}
