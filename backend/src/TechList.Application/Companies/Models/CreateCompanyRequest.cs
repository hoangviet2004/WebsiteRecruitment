using System.ComponentModel.DataAnnotations;

namespace TechList.Application.Companies.Models;

public sealed class CreateCompanyRequest
{
    [Required(ErrorMessage = "Company name is required")]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;

    [Url(ErrorMessage = "Invalid URL format")]
    [MaxLength(300)]
    public string Website { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Address { get; set; } = string.Empty;
}
