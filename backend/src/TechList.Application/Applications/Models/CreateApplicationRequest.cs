namespace TechList.Application.Applications.Models;

public class CreateApplicationRequest
{
    public Guid JobPostId { get; set; }
    public string? CoverLetter { get; set; }
}
