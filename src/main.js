
import { lerp, rgb_to_hex_str, rrr, rgb, range_lerp } from "./utils.js";

document.querySelector("#app").innerHTML = `<canvas id="canvas"></canvas>`;
const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");

let last_timestamp = 0;
let first_frame = true;
let delta = 0;
let start_timestamp = 0;
let mouse_count = 0;
let mouse_x = 0;
let mouse_y = 0;
let wheel = 0;
let mouse_down = false;
let darkness = [];
const belts = [];
const miners = [];
const resources = [];
const grid_size = 32;
const tile_size = 32;
let curr_slot = 0;
let curr_orientation = 0;
let key_events = [];
const padding = 4;
const updates_per_second = 60;
const items = [];
const item_size = Math.floor(tile_size / 2);

class s_timer
{
	constructor(duration)
	{
		this.passed = 0;
		this.duration = duration;
	}

	update(delta)
	{
		let result = 0;
		this.passed += delta;
		while(this.passed >= this.duration) {
			this.passed -= this.duration;
			result += 1;
		}
		return result;
	}
}

function frame(timestamp)
{
	delta = (timestamp - last_timestamp) / 1000.0;
	last_timestamp = timestamp;
	if(first_frame) {
		first_frame = false;
		canvas.width = window.innerWidth;
  	canvas.height = window.innerHeight;
		document.addEventListener("mouseup", on_mouse_up);
		document.addEventListener("mousemove", on_mouse_move);
		document.addEventListener("mousedown", on_mouse_down);
		document.addEventListener("wheel", on_mouse_wheel);
		document.addEventListener("keydown", on_key_down);
		document.addEventListener("keyup", on_key_up);
		window.addEventListener("resize", on_window_resize);
		// ctx.imageSmoothingEnabled = false;

		const center = Math.floor(grid_size / 2);
		for(let y = 0; y < grid_size; y += 1) {
			darkness[y] = new Array(grid_size);
			for(let x = 0; x < grid_size; x += 1) {
				const x_dist = Math.abs(center - x);
				const y_dist = Math.abs(center - y);
				if(y_dist > 5 || x_dist > 5) {
					darkness[y][x] = Math.random();
				}
				else {
					darkness[y][x] = 0;
				}
			}
		}
		resources.push({x: center, y: center, value: 0.1});

		start_timestamp = timestamp;
	}

	input();
	update();
	render();
	requestAnimationFrame(frame);

	mouse_count = 0;
	wheel = 0;
	key_events = [];
}

function input()
{
	for(let key_i = 0; key_i < key_events.length; key_i += 1) {
		const key = key_events[key_i];
		if(key.type === "down") {
			if(key.name === "1") {
				curr_slot = 0;
			}
			else if(key.name === "2") {
				curr_slot = 1;
			}
			else if(key.name === "r") {
				curr_orientation = (curr_orientation + 1) % 4;
			}
		}
	}
}

function update()
{
	const delta = 1.0 / updates_per_second;
	const x_index = Math.floor(mouse_x / grid_size);
	const y_index = Math.floor(mouse_y / grid_size);

	const dark = darkness[y_index][x_index];

	const resource = get_resource(x_index, y_index);
	if(
		is_mouse_down() && dark <= 0 && !get_miner(x_index, y_index) && !get_belt(v2(x_index, y_index))
	) {
		if(curr_slot === 0 && !resource) {
			let belt = {};
			belt.x = x_index;
			belt.y = y_index;
			belt.orientation = curr_orientation;
			belts.push(belt);
		}
		else if(curr_slot === 1 && resource) {
			let miner = {};
			miner.x = x_index;
			miner.y = y_index;
			miner.timer = new s_timer(1);
			miner.orientation = curr_orientation;
			miners.push(miner);
		}
	}

	for(let miner_i = 0; miner_i < miners.length; miner_i += 1) {
		const miner = miners[miner_i];

		const count = miner.timer.update(delta);
		for(let i = 0; i < count; i += 1) {
			let item = {};
			let x = miner.x;
			let y = miner.y;
			const offsets = [{x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}];
			x += offsets[miner.orientation].x;
			y += offsets[miner.orientation].y;
			if(get_item(v2(x, y))) { break; }
			item.pos = v2(x, y);
			item.belt_progress = 0;
			item.draw_pos = v2(item.pos.x * tile_size, item.pos.y * tile_size);
			items.push(item);
		}

		miner.time += delta;
	}

	// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv		item update start		vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
	for(let items_i = 0; items_i < items.length; items_i += 1) {
		const item = items[items_i];
		const pos = center_rect(item.pos, v2(item_size), v2(tile_size));
		const belt = get_belt(item.pos);

		if(belt) {
			const offsets = [{x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}];
			const offset = offsets[belt.orientation];
			item.belt_progress += delta * 0.3;
			const next_item = get_item(v2(item.pos.x + offset.x, item.pos.y + offset.y));
			if(next_item) {
				item.belt_progress = Math.min(item.belt_progress, 0.6);
			}

			const belt_pos = v2(belt.x * tile_size, belt.y * tile_size);
			const center = get_center(belt_pos, v2(tile_size));
			item.draw_pos = v2(
				center.x - tile_size / 2 * offset.x + (item.belt_progress + 0.5) * offset.x * tile_size,
				center.y - tile_size / 2 * offset.y + (item.belt_progress + 0.5) * offset.y * tile_size
			);

			if(item.belt_progress > 1) {
				item.belt_progress -= 1;
				item.pos.x += offset.x;
				item.pos.y += offset.y;
			}
		}
		else {
			item.draw_pos = v2(item.pos.x * tile_size + tile_size / 2, item.pos.y * tile_size + tile_size / 2);
		}
	}
	// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^		item update end		^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

}

function render()
{
	ctx.reset();
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.imageSmoothingEnabled = false;
	// ctx.fillStyle = "#111111";
	ctx.fillStyle = "#FFFFFF";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	for(let y = 0; y < grid_size; y += 1) {
		for(let x = 0; x < grid_size; x += 1) {
			const dark = darkness[y][x];
			if(dark > 0) {
				ctx.fillStyle = rgb_to_hex_str(rrr(range_lerp(dark, 0, 1, 0.2, 0)));
				ctx.fillRect(x * tile_size, y * tile_size, tile_size, tile_size);
			}
		}
	}

	const rotations = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
	for(let belt_i = 0; belt_i < belts.length; belt_i += 1) {
		const belt = belts[belt_i];
		ctx.fillStyle = "#ff0000";

		ctx.save();
		ctx.translate(belt.x * tile_size + tile_size / 2, belt.y * tile_size + tile_size / 2);
		ctx.rotate(rotations[belt.orientation]);
		ctx.translate(-(belt.x * tile_size + tile_size / 2), -(belt.y * tile_size + tile_size / 2));
		ctx.drawImage(document.querySelector("#athano"), belt.x * tile_size, belt.y * tile_size, tile_size, tile_size);
		ctx.restore();
	}

	for(let resource_i = 0; resource_i < resources.length; resource_i += 1) {
		const resource = resources[resource_i];
		ctx.fillStyle = "#00ff00";
		ctx.fillRect(resource.x * tile_size - padding, resource.y * tile_size - padding, tile_size + padding * 2, tile_size + padding * 2);
	}

	for(let miner_i = 0; miner_i < miners.length; miner_i += 1) {
		const miner = miners[miner_i];
		ctx.fillStyle = "#ffff00";
		ctx.fillRect(miner.x * tile_size, miner.y * tile_size, tile_size, tile_size);
	}

	// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv		render items start		vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
	for(let items_i = 0; items_i < items.length; items_i += 1) {
		const item = items[items_i];
		ctx.fillStyle = "#0000ff";
		// const pos = center_rect(item.draw_pos, v2(item_size), v2(tile_size));
		// ctx.fillRect(pos.x, pos.y, item_size, item_size);

		const pos = to_center(item.draw_pos, v2(item_size));

		ctx.fillRect(pos.x, pos.y, item_size, item_size);

		// const p = get_center(pos, v2(item_size));
		// ctx.fillStyle = "#00ff00";
		// ctx.fillRect(p.x, p.y, 4, 4);
	}
	// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^		render items end		^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
}

function get_resource(x, y)
{
	for(let resource_i = 0; resource_i < resources.length; resource_i += 1) {
		const resource = resources[resource_i];
		if(resource.x === x && resource.y == y) {
			return resource;
		}
	}
	return null;
}

function get_miner(x, y)
{
	for(let miner_i = 0; miner_i < miners.length; miner_i += 1) {
		const miner = miners[miner_i];
		if(miner.x === x && miner.y == y) {
			return miner;
		}
	}
	return null;
}

function get_belt(in_index)
{
	for(let belt_i = 0; belt_i < belts.length; belt_i += 1) {
		const belt = belts[belt_i];
		if(belt.x === in_index.x && belt.y == in_index.y) {
			return belt;
		}
	}
	return null;
}

function get_item(in_index)
{
	for(let item_i = 0; item_i < items.length; item_i += 1) {
		const item = items[item_i];
		if(item.pos.x === in_index.x && item.pos.y === in_index.y) {
			return item;
		}
	}
	return null;
}

function is_mouse_pressed()
{
	return (mouse_down && mouse_count === 1) || mouse_count > 1;
}

function is_mouse_released()
{
	return (!mouse_down && mouse_count === 1) || mouse_count > 1;
}

function is_mouse_down()
{
	return mouse_down;
}

function is_mouse_up()
{
	return !mouse_down;
}

function on_mouse_down(e)
{
	if(e.button === 0) {
		mouse_x = e.clientX;
		mouse_y = e.clientY;
		mouse_down = true;
		mouse_count += 1;
	}
}

function on_mouse_up(e)
{
	if(e.button === 0) {
		mouse_x = e.clientX;
		mouse_y = e.clientY;
		mouse_down = false;
		mouse_count += 1;
	}
}

function on_mouse_move(e)
{
	mouse_x = e.clientX;
	mouse_y = e.clientY;
}

function on_mouse_wheel(e)
{
	wheel += e.deltaY;
}

function on_key_down(e)
{
	key_events.push({name: e.key, type: "down"});
}

function on_key_up(e)
{
	key_events.push({name: e.key, type: "up"});
}

function on_window_resize()
{
	canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function center_rect(pos, size1, size2)
{
	return {
		x: pos.x + size2.x / 2 - size1.x / 2,
		y: pos.y + size2.y / 2 - size1.y / 2
	};
}

function v2(x, y)
{
	if(y === undefined) {
		return {x: x, y: x};
	}
	else {
		return {x: x, y: y};
	}
}

function pos_to_index_floor(pos)
{
	return v2(Math.floor(pos.x / tile_size), Math.floor(pos.y / tile_size));
}

function pos_to_index_round(pos)
{
	return v2(Math.round(pos.x / tile_size), Math.round(pos.y / tile_size));
}

function to_center(pos, size)
{
	return v2(pos.x - size.x / 2, pos.y - size.y / 2);
}

function get_center(pos, size)
{
	return v2(pos.x + size.x / 2, pos.y + size.y / 2);
}

frame();

