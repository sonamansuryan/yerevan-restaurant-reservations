// A restaurant's photos through the API: /api/owner/restaurants/:restaurantId/photos. The service is
// tested in photos.service.test.ts. Here it's replaced, to test the HTTP side: the ownership check,
// what's checked and cleaned before the service, and the replies.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { ConflictError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import {
  deletePhoto,
  getPhotos,
  makeCover,
  permitUpload,
  savePhoto,
} from "../src/modules/photos/photos.service.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani, davit, sessionUser } from "./fixtures/users.ts";

// The ownership check asks the database whether the restaurant is the owner's. Here only Ani's is.
vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { restaurant: { findUnique: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));
vi.mock("../src/modules/photos/photos.service.ts", () => ({
  getPhotos: vi.fn(),
  permitUpload: vi.fn(),
  savePhoto: vi.fn(),
  makeCover: vi.fn(),
  deletePhoto: vi.fn(),
}));

const ANIS = ownedRow().id;
const DAVITS = ownedRow({ id: "e5b8a7c6-9f0d-4e1b-8c23-4d5e6f708192", ownerId: davit.id }).id;
const PHOTO = "0f9c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f";
const photos = (restaurantId: string): string => `/api/owner/restaurants/${restaurantId}/photos`;

const upload = {
  publicId: `seghan/restaurants/${ANIS}/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d`,
  version: 1731240000,
  signature: "a".repeat(40),
};
const saved = [
  {
    id: PHOTO,
    url: `https://res.cloudinary.com/test-cloud/image/upload/v1731240000/${upload.publicId}`,
    isCover: true,
    sortOrder: 0,
  },
];

beforeEach(() => {
  vi.mocked(prisma.restaurant.findUnique).mockImplementation((({
    where,
  }: {
    where: { id: string; ownerId: string };
  }) =>
    Promise.resolve(where.id === ANIS && where.ownerId === ani.id ? { id: ANIS } : null)) as never);
});

afterEach(() => {
  vi.resetAllMocks();
});

async function call(
  method: "get" | "post" | "patch" | "delete",
  path: string,
  body?: object,
  user?: SessionUser,
): Promise<Response> {
  let req = request(app)[method](path);
  if (user) req = req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`);
  return body ? req.send(body) : req;
}

const UPLOAD_AGAIN = "Upload the photo again.";

describe("GET /photos", () => {
  test("an owner reads the photos as saved, in the same shape every change answers with", async () => {
    vi.mocked(getPhotos).mockResolvedValue(saved);

    const reply = await call("get", photos(ANIS), undefined, ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ photos: saved });
    expect(getPhotos).toHaveBeenCalledWith(ANIS);
  });
});

describe("POST /photos/signature", () => {
  test("an owner gets permission for one upload straight to Cloudinary", async () => {
    const permission = {
      url: "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
      fields: { api_key: "000000000000000", signature: "s", timestamp: "1", public_id: "p" },
    };
    vi.mocked(permitUpload).mockResolvedValue(permission);

    const reply = await call("post", `${photos(ANIS)}/signature`, undefined, ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ upload: permission });
    expect(permitUpload).toHaveBeenCalledWith(ANIS);
  });

  test("a restaurant with ten photos gets no permission (409)", async () => {
    vi.mocked(permitUpload).mockRejectedValue(
      new ConflictError(
        "TOO_MANY_PHOTOS",
        "A restaurant can have up to 10 photos. Delete one to add another.",
      ),
    );

    const reply = await call("post", `${photos(ANIS)}/signature`, undefined, ani);

    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe("TOO_MANY_PHOTOS");
  });
});

describe("POST /photos", () => {
  test("an owner saves an upload: 201, and only Cloudinary's three answers reach the service", async () => {
    vi.mocked(savePhoto).mockResolvedValue(saved);

    // The browser also tries to choose the address, the cover and the restaurant.
    const reply = await call(
      "post",
      photos(ANIS),
      { ...upload, url: "https://example.com/not-ours.jpg", isCover: true, restaurantId: DAVITS },
      ani,
    );

    expect(reply.status).toBe(201);
    expect(reply.body).toEqual({ photos: saved });
    expect(savePhoto).toHaveBeenCalledWith(ani.id, ANIS, upload);
  });

  test("anything but Cloudinary's answer for one of our uploads is refused (400)", async () => {
    const reply = await call(
      "post",
      photos(ANIS),
      { publicId: "https://example.com/photo.jpg", version: "1", signature: "not hex" },
      ani,
    );

    expect(reply.status).toBe(400);
    expect(reply.body.error.details).toEqual({
      fields: { publicId: UPLOAD_AGAIN, version: UPLOAD_AGAIN, signature: UPLOAD_AGAIN },
    });
    expect(savePhoto).not.toHaveBeenCalled();
  });
});

describe("PATCH /photos/:photoId", () => {
  test("an owner chooses the cover: 200, with the photos in their new order", async () => {
    vi.mocked(makeCover).mockResolvedValue(saved);

    const reply = await call("patch", `${photos(ANIS)}/${PHOTO}`, { isCover: true }, ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ photos: saved });
    expect(makeCover).toHaveBeenCalledWith(ani.id, ANIS, PHOTO);
  });

  test("a cover can be moved but not removed, and a photo id has to be one", async () => {
    const removing = await call("patch", `${photos(ANIS)}/${PHOTO}`, { isCover: false }, ani);
    const badId = await call("patch", `${photos(ANIS)}/cover`, { isCover: true }, ani);

    expect(removing.body.error.details).toEqual({
      fields: { isCover: "Choose a photo as the cover." },
    });
    expect(badId.body.error.details).toEqual({ fields: { photoId: "Choose a photo." } });
    expect(makeCover).not.toHaveBeenCalled();
  });
});

describe("DELETE /photos/:photoId", () => {
  test("an owner deletes a photo: 200, with the photos left", async () => {
    vi.mocked(deletePhoto).mockResolvedValue([]);

    const reply = await call("delete", `${photos(ANIS)}/${PHOTO}`, undefined, ani);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ photos: [] });
    expect(deletePhoto).toHaveBeenCalledWith(ani.id, ANIS, PHOTO);
  });
});

describe("only the owner's own restaurant", () => {
  const routes = [
    ["get", "", undefined],
    ["post", "/signature", undefined],
    ["post", "", upload],
    ["patch", `/${PHOTO}`, { isCover: true }],
    ["delete", `/${PHOTO}`, undefined],
  ] as const;

  test("someone else's restaurant is a 404 at every photo address", async () => {
    for (const [method, path, body] of routes) {
      const reply = await call(method, `${photos(DAVITS)}${path}`, body, ani);

      expect(reply.status).toBe(404);
      expect(reply.body.error.code).toBe("RESTAURANT_NOT_FOUND");
    }
    expect(getPhotos).not.toHaveBeenCalled();
    expect(permitUpload).not.toHaveBeenCalled();
    expect(savePhoto).not.toHaveBeenCalled();
    expect(makeCover).not.toHaveBeenCalled();
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  test("signed out gets 401 and a customer 403, at every photo address", async () => {
    for (const [method, path, body] of routes) {
      expect((await call(method, `${photos(ANIS)}${path}`, body)).status).toBe(401);
      expect((await call(method, `${photos(ANIS)}${path}`, body, sessionUser)).status).toBe(403);
    }
    expect(savePhoto).not.toHaveBeenCalled();
  });
});
