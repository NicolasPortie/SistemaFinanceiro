FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["src/ControlFinance.Api/ControlFinance.Api.csproj", "src/ControlFinance.Api/"]
COPY ["src/ControlFinance.Application/ControlFinance.Application.csproj", "src/ControlFinance.Application/"]
COPY ["src/ControlFinance.Domain/ControlFinance.Domain.csproj", "src/ControlFinance.Domain/"]
COPY ["src/ControlFinance.Infrastructure/ControlFinance.Infrastructure.csproj", "src/ControlFinance.Infrastructure/"]

RUN dotnet restore "src/ControlFinance.Api/ControlFinance.Api.csproj"

COPY src ./src
RUN dotnet publish "src/ControlFinance.Api/ControlFinance.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Criar usuário não-root para segurança
RUN addgroup --system --gid 1001 dotnetapp && \
    adduser --system --uid 1001 --ingroup dotnetapp dotnetapp

# Instalar curl para healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000

COPY --from=build /app/publish .

# Executar como usuário não-root
USER dotnetapp

ENTRYPOINT ["dotnet", "ControlFinance.Api.dll"]
