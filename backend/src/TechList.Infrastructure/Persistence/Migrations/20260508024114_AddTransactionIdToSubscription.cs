using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TechList.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionIdToSubscription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TransactionId",
                table: "Subscriptions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_TransactionId",
                table: "Subscriptions",
                column: "TransactionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Subscriptions_Transactions_TransactionId",
                table: "Subscriptions",
                column: "TransactionId",
                principalTable: "Transactions",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Subscriptions_Transactions_TransactionId",
                table: "Subscriptions");

            migrationBuilder.DropIndex(
                name: "IX_Subscriptions_TransactionId",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "TransactionId",
                table: "Subscriptions");
        }
    }
}
