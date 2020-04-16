import handleMouseEvents from './mouse-evt.mjs';

const Dragging = Object.freeze({
	NONE: Symbol('NONE'),
	LEFT_HANDLE: Symbol('LEFT_HANDLE'),
	RIGHT_HANDLE: Symbol('RIGHT_HANDLE'),
	BAR: Symbol('BAR')
});

class Scrollbar {
	constructor (canvas, w, h) {
		this._canvas = canvas;
		this._ctx = canvas.getContext('2d');
		this._size = [0, 0];

		this._measurements = {
			barRadius: 0,
			width: 0,
			startX: 0,
			endX: 0
		};

		this._uiState = {
			leftHandleHovered: false,
			rightHandleHovered: false,
			barHovered: false
		}

		this._dragState = {
			dragOffset: 0,
			dragging: Dragging.NONE,
			initScrollStart: 0,
			initScrollEnd: 0
		}

		this.scrollStart = 0;
		this.scrollEnd = 1;

		this.resize(w, h);

		handleMouseEvents(
			canvas,
			this._handleMouseDown.bind(this),
			this._handleMouseUp.bind(this),
			null,
			this._handleMouseMove.bind(this)
		);

		this.onScroll = null;
	}

	_updateMeasurements () {
		const m = this._measurements;
		m.barRadius = this._size[1] / 2;
		m.width = this._size[0] - this._size[1];
		m.startX = (m.width * this.scrollStart) + m.barRadius;
		m.endX = (m.width * this.scrollEnd) + m.barRadius;
	}

	_handleMouseDown (eventX, eventY) {
		const relativeX = eventX - this._canvas.getBoundingClientRect().left;
		if (this._uiState.leftHandleHovered || this._uiState.rightHandleHovered) {
			this._dragState.dragging = this._uiState.rightHandleHovered ? Dragging.RIGHT_HANDLE : Dragging.LEFT_HANDLE;
			const handleX = (this._dragState.dragging === Dragging.RIGHT_HANDLE ? this.scrollEnd : this.scrollStart) * (this._size[0] - this._size[1]);
			this._dragState.dragOffset = relativeX - handleX;
		} else if (this._uiState.barHovered) {
			this._dragState.initScrollStart = this.scrollStart;
			this._dragState.initScrollEnd = this.scrollEnd;
			this._dragState.dragOffset = relativeX;
			this._dragState.dragging = Dragging.BAR
		}
	}

	_handleMouseUp () {
		this._dragState.dragging = Dragging.NONE;
	}

	_handleMouseMove (eventX, eventY) {
		const bounds = this._canvas.getBoundingClientRect();
		const x = eventX - bounds.left;
		const y = eventY - bounds.top;

		if (this._dragState.dragging !== Dragging.NONE) {
			// dragging a handle
			if (this._dragState.dragging === Dragging.LEFT_HANDLE || this._dragState.dragging === Dragging.RIGHT_HANDLE) {
				const calcScroll = (x - this._dragState.dragOffset) / (this._size[0] - this._size[1]);
				this[this._dragState.dragging === Dragging.RIGHT_HANDLE ? 'scrollEnd' : 'scrollStart'] = calcScroll;

				if (this.scrollEnd < this.scrollStart) {
					const tmp = this.scrollStart;
					this.scrollStart = this.scrollEnd;
					this.scrollEnd = tmp;
					this._dragState.dragging = (this._dragState.dragging === Dragging.LEFT_HANDLE ? Dragging.RIGHT_HANDLE : Dragging.LEFT_HANDLE);
				}

				this.scrollStart = Math.max(0, this.scrollStart);
				this.scrollEnd = Math.min(1, this.scrollEnd);
			} else {
				// dragging a bar
				const calcScroll = (x - this._dragState.dragOffset) / (this._size[0] - this._size[1]);
				this.scrollStart = Math.min(1, Math.max(0, this._dragState.initScrollStart + calcScroll));
				this.scrollEnd = Math.max(0, Math.min(1, this._dragState.initScrollEnd + calcScroll));
			}

			if (this.onScroll) this.onScroll();
		}

		this._updateMeasurements();
		this._uiState.leftHandleHovered = Math.hypot(
			x - this._measurements.startX,
			y - this._measurements.barRadius
		) <= this._measurements.barRadius;

		this._uiState.rightHandleHovered = !this._uiState.leftHandleHovered && Math.hypot(
			x - this._measurements.endX,
			y - this._measurements.barRadius
		) <= this._measurements.barRadius;

		this._uiState.barHovered =
			x >= this._measurements.startX && x <= this._measurements.endX &&
			y >= 0 && y < this._size[1] &&
			!(this._uiState.leftHandleHovered || this._uiState.rightHandleHovered);

		this._draw();
	}

	_draw () {
		this._updateMeasurements();

		const ctx = this._ctx;

		ctx.clearRect(0, 0, this._size[0], this._size[1]);

		const offset = this._size[1] / 2;
		const end = this._size[0] - offset;

		ctx.lineWidth = this._size[1];
		ctx.lineCap = 'round';

		ctx.strokeStyle = `rgba(0, 0, 0, 0.1)`;
		ctx.beginPath();
		ctx.moveTo(offset, offset);
		ctx.lineTo(end, offset);
		ctx.stroke();

		const {barHovered} = this._uiState;
		ctx.strokeStyle = `rgba(0, 0, 0, ${barHovered ? '0.375' : '0.25'})`;
		ctx.beginPath();
		ctx.moveTo(this._measurements.startX, offset);
		ctx.lineTo(this._measurements.endX, offset);
		ctx.stroke();

		for (const {handleX, handleHovered} of [
			{handleX: this._measurements.startX, handleHovered: this._uiState.leftHandleHovered},
			{handleX: this._measurements.endX, handleHovered: this._uiState.rightHandleHovered},
		]) {
			const handleStrokeWidth = 4;
			ctx.fillStyle = `rgba(0, 0, 0, ${handleHovered ? '0.5' : '0.25'})`;
			ctx.strokeStyle = `rgba(64, 64, 64, 1)`;
			ctx.lineWidth = handleStrokeWidth;
			ctx.beginPath();
			ctx.arc(handleX, offset, offset - (handleStrokeWidth / 2), 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}

		this._canvas.style.cursor = this._uiState.leftHandleHovered || this._uiState.rightHandleHovered || this._uiState.barHovered ? 'pointer' : 'default';
	}

	resize (width, height) {
		this._size[0] = width;
		this._size[1] = this._canvas.height = height;

		this._canvas.width = width;

		this._draw();
	}
}

export default Scrollbar;
