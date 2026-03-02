// Quick script to extract PDF structure - run as a test
using System;
using System.IO;
using System.Linq;
using System.Text;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

var pdfPath = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "extrato", "extrato-2026-01-31-2026-03-01.pdf");
Console.WriteLine($"Looking for: {pdfPath}");
