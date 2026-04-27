using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TechList.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxCodeToCompany : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TaxCode",
                table: "Companies",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TaxCode",
                table: "Companies");
        }
    }
}
