using FluentValidation;
using TechList.Application.Auth.Models;
using TechList.Domain.Enums;

namespace TechList.Application.Auth.Validators;

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().EmailAddress();

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8);

        RuleFor(x => x.Role)
            .NotEmpty()
            .Must(r => AppRole.All.Contains(r))
            .WithMessage($"Role must be one of: {string.Join(", ", AppRole.All)}");

        RuleFor(x => x.DisplayName)
            .MaximumLength(200);
    }
}

