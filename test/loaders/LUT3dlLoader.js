import test from "ava";
import { readFileSync } from "node:fs";
import { LUT3dlLoader } from "postprocessing";

const root = new URL("../../", import.meta.url);
const text = readFileSync(
	new URL("demo/static/textures/lut/3dl/presetpro-cinematic.3dl", root),
	"utf8"
);

const EPS_LISTED = 1e-6;
const index = (r, g, b) => (r + g * 32 + b * 32 * 32) * 4;

test("can be created", t => {

	t.truthy(new LUT3dlLoader());

});

test("parses the grid and scales values to [0, 1]", t => {

	const lut = new LUT3dlLoader().parse(text);
	const data = lut.image.data;

	t.is(lut.image.width, 32);
	t.is(lut.image.height, 32);
	t.is(lut.image.depth, 32);

	t.true(Math.abs(data[index(1, 0, 0) + 0] - 0.101807) <= EPS_LISTED);
	t.true(Math.abs(data[index(1, 0, 0) + 1] - 0.093994) <= EPS_LISTED);
	t.true(Math.abs(data[index(1, 0, 0) + 2] - 0.105713) <= EPS_LISTED);

	t.true(Math.abs(data[index(0, 1, 0) + 0] - 0.109619) <= EPS_LISTED);
	t.true(Math.abs(data[index(0, 1, 0) + 1] - 0.090332) <= EPS_LISTED);
	t.true(Math.abs(data[index(0, 1, 0) + 2] - 0.105713) <= EPS_LISTED);

	t.true(Math.abs(data[index(0, 0, 1) + 0] - 0.102051) <= EPS_LISTED);
	t.true(Math.abs(data[index(0, 0, 1) + 1] - 0.093994) <= EPS_LISTED);
	t.true(Math.abs(data[index(0, 0, 1) + 2] - 0.106201) <= EPS_LISTED);

});

test("fails on missing grid information", t => {

	t.throws(() => new LUT3dlLoader().parse("# only comments\n"));

});
