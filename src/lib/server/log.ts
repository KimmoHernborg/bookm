type LogFields = Record<string, unknown>;

function emit(
	level: "info" | "warn" | "error",
	event: string,
	fields?: LogFields,
) {
	console.log(
		JSON.stringify({
			time: new Date().toISOString(),
			level,
			event,
			...fields,
		}),
	);
}

export const log = {
	info: (event: string, fields?: LogFields) => emit("info", event, fields),
	warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
	error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
