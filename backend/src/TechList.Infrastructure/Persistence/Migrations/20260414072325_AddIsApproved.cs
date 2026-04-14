using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TechList.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIsApproved : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsApproved",
                table: "UserProfiles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsApproved",
                table: "JobPosts",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsApproved",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "IsApproved",
                table: "JobPosts");
        }
    }
}
