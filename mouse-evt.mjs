function handleMouseEvents (element, onStart, onEnd, onMove) {
	let dragging = false;

	element.addEventListener('mousedown', event => {
		dragging = true;
		onStart(event.clientX, event.clientY);
	}, false);

	element.addEventListener('mouseup', event => {
		dragging = false;
		onEnd(event.clientX, event.clientY);
	}, false);

	document.addEventListener('mousemove', event => {
		if (dragging) {
			event.preventDefault();
			onMove(event.clientX, event.clientY);
		}
	}, false);
}

export default handleMouseEvents;