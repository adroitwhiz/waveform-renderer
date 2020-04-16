import WaveformRenderer from './waveform-renderer.mjs';
import Scrollbar from './scrollbar.mjs';
import handleMouseEvents from './mouse-evt.mjs';

const perfElem = document.getElementById('perf');
const perfLog = msg => {
	const line = document.createElement('div');
	line.appendChild(document.createTextNode(msg));
	perfElem.appendChild(line);
}
const perfClear = () => {
	while (perfElem.firstChild) {
		perfElem.removeChild(perfElem.firstChild);
	}
}

const audioContext = new window.AudioContext({sampleRate: 44100});

Promise.all([
	fetch('vertex.glsl').then(response => response.text()).then(text => {window.VERTEX_SOURCE = text}),
	fetch('fragment.glsl').then(response => response.text()).then(text => {window.FRAGMENT_SOURCE = text}),
	fetch('audio-levels.glsl').then(response => response.text()).then(text => {window.AUDIO_CALC_SOURCE = text})
]).then(() => {
	const renderer = new WaveformRenderer(document.getElementById('wavecanvas'));
	const scrollbar = new Scrollbar(document.getElementById('scrollbar'), 900, 50);

	scrollbar.onScroll = () => {
		renderer.setScrollRange(scrollbar.scrollStart, scrollbar.scrollEnd);
	}

	document.getElementById('file').addEventListener('change', event => {
		const file = event.target.files[0];
		if (!file) return;

		const startTime = performance.now();

		const reader = new FileReader();
		reader.addEventListener('load', () => {
			const fileLoadTime = performance.now();
			audioContext.decodeAudioData(
				reader.result,
				buf => {
					const audioDecodeTime = performance.now();

					const channelData = buf.getChannelData(0);
					const now = performance.now();
					renderer.setAudioSamples(channelData);
					renderer.resize(900, 350);
					renderer.draw();

					const drawTime = performance.now();

					perfClear();
					perfLog(`${buf.duration.toFixed(1)} seconds of audio (${channelData.length} samples)`);
					perfLog(`File loaded in ${(fileLoadTime - startTime).toFixed(1)} ms`);
					perfLog(`Audio decoded in ${(audioDecodeTime - fileLoadTime).toFixed(1)} ms`);
					perfLog(`Waveform drawn in ${(drawTime - audioDecodeTime).toFixed(1)} ms`);
				},
				() => {
					console.error('Failed to decode audio');
				}
			);
		})
		reader.readAsArrayBuffer(file);
	});

	const resizeBar = document.getElementById('resize');
	const waveView = document.getElementById('waveview');

	let xOffset = 0;
	let initialY = 0;

	handleMouseEvents(resizeBar,
		(x, y) => {
			xOffset = x - resizeBar.getBoundingClientRect().left;
		},
		null,
		(x, y) => {
			const waveviewRect = waveView.getBoundingClientRect();
			waveView.style.width = (x - waveviewRect.left - xOffset) + 'px';

			const resizedRect = waveView.getBoundingClientRect();
			renderer.resize(resizedRect.width, 350);
			scrollbar.resize(resizedRect.width, 50);
		}
	);
});
