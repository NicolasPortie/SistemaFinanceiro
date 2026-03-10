using ControlFinance.Api.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControlFinanceApi(builder.Configuration);

var app = builder.Build();

if (!await app.InitializeControlFinanceAsync(args))
{
    return;
}

app.UseControlFinanceApi();

app.Run();
