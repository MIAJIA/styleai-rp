import { POST } from "./route";
import { NextResponse } from "next/server";
import FormData from "form-data";

// Mock the NextResponse.json to make it easier to inspect the response.
jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      json: async () => body,
    })),
  },
}));

describe("POST /api/generate", () => {
  beforeEach(() => {
    (NextResponse.json as jest.Mock).mockClear();
  });

  it("should return a 200 OK with an image URL on successful generation", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("human_image", "fake_human_data", "human.png");
    formData.append("garment_image", "fake_garment_data", "garment.png");

    // We directly mock the request object with a formData method
    const request = {
      formData: async () => formData,
    } as any;

    // Act
    const response = await POST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toHaveProperty("imageUrl");
    expect(typeof body.imageUrl).toBe("string");
  });

  it("should return a 400 Bad Request if files are missing", async () => {
    // Arrange
    const formData = new FormData(); // Empty form data

    const request = {
      formData: async () => formData,
    } as any;

    // Act
    const response = await POST(request);
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body).toHaveProperty("error");
    expect(body.error).toBe("Missing human_image or garment_image");
  });
});