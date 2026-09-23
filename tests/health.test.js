const request = require("supertest");

const app = require("../server");

test("Health API should return UP", async () => {
    const response = await request(app).get("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("UP");
});