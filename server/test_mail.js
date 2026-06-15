import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function testMail() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  console.log("=== Mail Configuration Test ===");
  console.log("SMTP_HOST:", SMTP_HOST || "(not set)");
  console.log("SMTP_PORT:", SMTP_PORT || "(not set, default 587)");
  console.log("SMTP_USER:", SMTP_USER || "(not set)");
  console.log("SMTP_PASS:", SMTP_PASS ? "********" : "(not set)");
  console.log("SMTP_SECURE:", SMTP_SECURE || "false");

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("\n[!] WARNING: Mail is currently disabled because SMTP_HOST, SMTP_USER, or SMTP_PASS is missing in .env.");
    console.log("To configure, add the following to your .env file:");
    console.log("SMTP_HOST=smtp.gmail.com");
    console.log("SMTP_PORT=587");
    console.log("SMTP_USER=your-email@gmail.com");
    console.log("SMTP_PASS=your-app-password");
    console.log("SMTP_SECURE=false");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE || "false") === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  try {
    console.log("\nAttempting to connect to SMTP server...");
    await transporter.verify();
    console.log("[✓] SMTP Connection successful!");

    console.log("Sending test email to huzefarampurawala9@gmail.com...");
    const info = await transporter.sendMail({
      from: `"HAAK Assets Test" <${SMTP_USER}>`,
      to: "huzefarampurawala9@gmail.com",
      subject: "HAAK Assets Mail Integration Test",
      text: "This is a test email from HAAK Asset Management app to verify your SMTP settings. If you receive this, your mail system is configured correctly!",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #ef4444;">Mail Integration Test</h2>
          <p>This is a test email to verify your SMTP settings in the HAAK Asset Management application.</p>
          <p style="background-color: #f3f4f6; padding: 10px; border-left: 4px solid #ef4444; border-radius: 4px;">
            <strong>Status:</strong> Success! The mail configuration is working correctly.
          </p>
          <p>No further action is required.</p>
        </div>
      `
    });

    console.log("[✓] Test email sent successfully!");
    console.log("Message ID:", info.messageId);

  } catch (error) {
    console.error("\n[✗] Mail test failed with error:");
    console.error(error.message);
    console.log("\nTroubleshooting tips:");
    console.log("1. Double check your SMTP username and password.");
    console.log("2. If using Gmail, make sure you are using an 'App Password', not your regular login password.");
    console.log("3. Verify if port 587 is blocked by your hosting provider or network firewall.");
  }
}

testMail();
