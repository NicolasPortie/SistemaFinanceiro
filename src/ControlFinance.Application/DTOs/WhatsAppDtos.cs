namespace ControlFinance.Application.DTOs;

public class WhatsAppWebhookRequest
{
    public string PhoneNumber { get; set; } = string.Empty;
    public string MessageId { get; set; } = string.Empty;
    public string Type { get; set; } = "text";
    public string? Text { get; set; }
    public string? AudioData { get; set; }
    public string? AudioMimeType { get; set; }
    public string? ImageData { get; set; }
    public string? ImageMimeType { get; set; }
    public string? ImageCaption { get; set; }
    public string? PushName { get; set; }
    public long Timestamp { get; set; }
    public bool IsVoiceNote { get; set; }
}

public class WhatsAppWebhookResponse
{
    public string Reply { get; set; } = string.Empty;
    public bool Success { get; set; } = true;
    public string? Error { get; set; }
}

public class WhatsAppSendRequest
{
    public string PhoneNumber { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
