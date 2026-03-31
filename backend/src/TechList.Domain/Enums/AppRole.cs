namespace TechList.Domain.Enums;

public static class AppRole
{
    public const string Admin     = "Admin";
    public const string Recruiter = "Recruiter";
    public const string Candidate = "Candidate";

    public static readonly string[] All = [Admin, Recruiter, Candidate];
}

