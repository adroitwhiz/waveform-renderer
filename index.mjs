import WaveformRenderer from './waveform-renderer.mjs';
import handleMouseEvents from './mouse-evt.mjs';

const audioContext = new window.AudioContext();

Promise.all([
	fetch('vertex.glsl').then(response => response.text()).then(text => {window.VERTEX_SOURCE = text}),
	fetch('fragment.glsl').then(response => response.text()).then(text => {window.FRAGMENT_SOURCE = text})
]).then(() => {
	const renderer = new WaveformRenderer(document.getElementById('wavecanvas'));

	document.getElementById('file').addEventListener('change', event => {
		const file = event.target.files[0];
		if (!file) return;

		const reader = new FileReader();
		reader.addEventListener('load', () => {
			audioContext.decodeAudioData(
				reader.result,
				buf => {
					const channelData = buf.getChannelData(0);
					const now = performance.now();
					renderer.setAudioSamples(channelData);
					renderer.resize(900, 350);
					renderer.draw();

					document.getElementById('perf').textContent = `Loaded + drawn in ${(performance.now() - now).toFixed(1)} ms`
				},
				() => {
					console.error('Failed to decode audio');
				}
			);
		})
		reader.readAsArrayBuffer(file);

		const resizeBar = document.getElementById('resize');
		const waveView = document.getElementById('waveview');

		let xOffset = 0;
		let initialY = 0;

		handleMouseEvents(resizeBar,
			(x, y) => {
				xOffset = x - resizeBar.getBoundingClientRect().left;
			},
			() => {},
			(x, y) => {
				const waveviewRect = waveView.getBoundingClientRect();
				waveView.style.width = (x - waveviewRect.left - xOffset) + 'px';

				const resizedRect = waveView.getBoundingClientRect();
				renderer.resize(resizedRect.width, 350)
			}
		);
	})
});
