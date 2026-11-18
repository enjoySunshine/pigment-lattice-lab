import test from "ava";
import { readFileSync } from "node:fs";
import {
	LookupTexture3D,
	LUTCubeLoader,
	TetrahedralUpscaler
} from "postprocessing";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const djangoText = read("demo/static/textures/lut/cube/django-25.cube");
const presetText = read("demo/static/textures/lut/cube/presetpro-cinematic.cube");

const EPS = 1e-7;
const EPS_LISTED = 1e-6;

const index32 = (r, g, b) => (r + g * 32 + b * 32 * 32) * 4;
const index64 = (r, g, b) => (r + g * 64 + b * 64 * 64) * 4;

test("parses django cube metadata and grid values", t => {

	const lut = new LUTCubeLoader().parse(djangoText);
	const data = lut.image.data;

	t.is(lut.image.width, 32);
	t.is(lut.name, "Untitled");
	t.deepEqual(lut.domainMin.toArray(), [0, 0, 0]);
	t.deepEqual(lut.domainMax.toArray(), [1, 1, 1]);

	t.true(Math.abs(data[index32(16, 8, 4) + 0] - 0.434479) <= EPS_LISTED);
	t.true(Math.abs(data[index32(16, 8, 4) + 1] - 0.183075) <= EPS_LISTED);
	t.true(Math.abs(data[index32(16, 8, 4) + 2] - 0.059113) <= EPS_LISTED);
	t.is(data[index32(16, 8, 4) + 3], 1);

});

test("parses presetpro cube metadata and grid values", t => {

	const lut = new LUTCubeLoader().parse(presetText);
	const data = lut.image.data;

	t.is(lut.image.width, 32);
	t.is(lut.name, "Presetpro - Cinematic");
	t.deepEqual(lut.domainMin.toArray(), [0, 0, 0]);
	t.deepEqual(lut.domainMax.toArray(), [1, 1, 1]);

	t.true(Math.abs(data[index32(0, 0, 0) + 0] - 0.101959) <= EPS_LISTED);
	t.true(Math.abs(data[index32(0, 0, 0) + 1] - 0.094116) <= EPS_LISTED);
	t.true(Math.abs(data[index32(0, 0, 0) + 2] - 0.105896) <= EPS_LISTED);
	t.true(Math.abs(data[index32(16, 8, 4) + 0] - 0.419861) <= EPS_LISTED);
	t.true(Math.abs(data[index32(16, 8, 4) + 1] - 0.213287) <= EPS_LISTED);
	t.true(Math.abs(data[index32(16, 8, 4) + 2] - 0.142059) <= EPS_LISTED);

});

test("upscales cube LUTs to sidelength 64 with tetrahedral interpolation", t => {

	const django = new LUTCubeLoader().parse(djangoText);
	const preset = new LUTCubeLoader().parse(presetText);
	const django64 = django.scaleUpSync(64);
	const preset64 = preset.scaleUpSync(64);

	t.is(django64.image.width, 64);
	t.is(django64.image.height, 64);
	t.is(django64.image.depth, 64);
	t.is(preset64.image.width, 64);
	t.is(django64.name, "Untitled");
	t.is(preset64.name, "Presetpro - Cinematic");

	// The source LUT is not modified.
	t.is(django.image.width, 32);

	const d = django64.image.data;
	t.true(Math.abs(d[index64(21, 11, 7) + 0] - 0.257088) <= EPS_LISTED);
	t.true(Math.abs(d[index64(21, 11, 7) + 1] - 0.100116) <= EPS_LISTED);
	t.true(Math.abs(d[index64(21, 11, 7) + 2] - 0.041400) <= EPS_LISTED);
	t.true(Math.abs(d[index64(63, 63, 63) + 0] - 0.865723) <= EPS_LISTED);
	t.true(Math.abs(d[index64(63, 63, 63) + 1] - 0.865723) <= EPS_LISTED);
	t.true(Math.abs(d[index64(63, 63, 63) + 2] - 0.865723) <= EPS_LISTED);
	t.is(d[index64(0, 0, 0) + 0], 0);
	t.is(d[index64(0, 0, 0) + 1], 0);
	t.is(d[index64(0, 0, 0) + 2], 0);

	const p = preset64.image.data;
	t.true(Math.abs(p[index64(21, 11, 7) + 0] - 0.262600) <= EPS_LISTED);
	t.true(Math.abs(p[index64(21, 11, 7) + 1] - 0.158725) <= EPS_LISTED);
	t.true(Math.abs(p[index64(21, 11, 7) + 2] - 0.142466) <= EPS_LISTED);
	t.true(Math.abs(p[index64(63, 63, 63) + 0] - 1.0) <= EPS_LISTED);
	t.true(Math.abs(p[index64(63, 63, 63) + 1] - 0.996063) <= EPS_LISTED);
	t.true(Math.abs(p[index64(63, 63, 63) + 2] - 1.0) <= EPS_LISTED);

});

test("keeps the input domain when upscaling", t => {

	const lut = new LUTCubeLoader().parse(presetText);
	const upscaled = lut.scaleUpSync(64);

	t.deepEqual(upscaled.domainMin.toArray(), [0, 0, 0]);
	t.deepEqual(upscaled.domainMax.toArray(), [1, 1, 1]);

});

test("rejects non-growing synchronous scale up", t => {

	const lut = new LUTCubeLoader().parse(djangoText);
	t.throws(() => lut.scaleUpSync(32), { message: /greater than the current size/ });

});

test("exposes scale up as a promise with the same result", async t => {

	const lut = new LUTCubeLoader().parse(djangoText);
	const upscaled = await lut.scaleUp(64);

	t.is(upscaled.image.width, 64);
	t.true(Math.abs(
		upscaled.image.data[index64(21, 11, 7)] - 0.257088) <= EPS_LISTED);

});

test("matches a generated neutral LUT after upscaling 4 to 32", t => {

	const source = LookupTexture3D.createNeutral(4);
	const expected = LookupTexture3D.createNeutral(32).image.data;
	const result = TetrahedralUpscaler.expand(source.image.data, 32);

	t.is(result.length, expected.length);

	for(let i = 0; i < result.length; ++i) {

		t.true(Math.abs(result[i] - expected[i]) <= EPS);

	}

});

test("preserves byte type and corner values when upscaling byte data", t => {

	const size = 4;
	const data = new Uint8Array(size ** 3 * 4);

	for(let b = 0; b < size; ++b) {

		for(let g = 0; g < size; ++g) {

			for(let r = 0; r < size; ++r) {

				const i4 = (r + g * size + b * size * size) * 4;
				data[i4 + 0] = 10;
				data[i4 + 1] = 20;
				data[i4 + 2] = 30;
				data[i4 + 3] = 255;

			}

		}

	}

	const result = TetrahedralUpscaler.expand(data, 6);
	t.true(result instanceof Uint8Array);

	for(let i = 0; i < result.length; i += 4) {

		t.is(result[i + 0], 10);
		t.is(result[i + 1], 20);
		t.is(result[i + 2], 30);
		t.is(result[i + 3], 255);

	}

});
