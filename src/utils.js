
export function mouse_collides_rect(x, y, sx, sy)
{
	return mouse_x > x && mouse_x < x + sx &&
		mouse_y > y && mouse_y < y + sy;
}

export function lerp(a, b, dt)
{
	return a + (b - a) * dt;
}

export function ilerp(a, b, c)
{
	return (c - a) / (b - a);
}

export function clamp(current, min, max)
{
	return Math.max(Math.min(max, current), min);
}

export function range_lerp(current, amin, amax, bmin, bmax)
{
	const p = ilerp(amin, amax, current);
	return lerp(bmin, bmax, p);
}

export function get_seconds(timestamp)
{
	return (timestamp - start_timestamp) / 1000.0;
}

export function rgb_to_hex_str(rgb)
{
	const r = rgb.r * 255;
	const g = rgb.g * 255;
	const b = rgb.b * 255;
	const val = ((255 << 24 >>> 0) | r << 16 | g << 8 | b) >>> 0;
	const result = val.toString(16).substring(2);
	return "#" + result;
}

export function multiply_color(rgb, mul)
{
	rgb.r = clamp(rgb.r * mul, 0, 1);
	rgb.g = clamp(rgb.g * mul, 0, 1);
	rgb.b = clamp(rgb.b * mul, 0, 1);
	return rgb;
}

export function rgb(r, g, b)
{
	return {r: r, g: g, b: b}
}

export function rrr(r)
{
	return {r: r, g: r, b: r}
}
