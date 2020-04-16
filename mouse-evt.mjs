function handleMouseEvents (element, onStart, onEnd, onDrag, onMove) {
	console.log(element);
	let dragging = false;

	element.addEventListener('mousedown', event => {
		dragging = true;
		if (onStart) onStart(event.clientX, event.clientY);
	}, false);

	document.addEventListener('mouseup', event => {
		dragging = false;
		if (onEnd) onEnd(event.clientX, event.clientY);
	}, false);

	if (onDrag) document.addEventListener('mousemove', event => {
		if (dragging) {
			event.preventDefault();
			onDrag(event.clientX, event.clientY);
		}
	}, false);

	if (onMove) document.addEventListener('mousemove', event => {
		onMove(event.clientX, event.clientY);
	}, false);
}

export default handleMouseEvents;