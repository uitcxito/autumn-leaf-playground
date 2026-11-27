/* Quiet procedural woodland ambience and short, gesture-driven sounds. */
(() => {
  window.createLeafAudio = function () {
    let context, master, texture, wind, breeze, breezeDepth, birds, crackles;
    let enabled = false, paused = false, revision = 0;
    let lastRake = -Infinity;
    const random = (a,b) => a + Math.random() * (b-a);

    function initialize() {
      const AudioAPI = window.AudioContext || window.webkitAudioContext;
      if (!AudioAPI) return false;
      try {
        context = new AudioAPI();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        // A continuous noise bed shared by wind and rustles. Each gesture starts
        // at a new offset, with its own filter, level and movement.
        const length = Math.round(context.sampleRate * 3);
        texture = context.createBuffer(1, length, context.sampleRate);
        const channel = texture.getChannelData(0);
        for (let i = 0; i < length; i++) channel[i] = random(-1,1);
        wind = context.createBufferSource();
        wind.buffer = texture;
        wind.loop = true;
        const low = context.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 710;
        low.Q.value = 0.12;
        const high = context.createBiquadFilter();
        high.type = 'highpass';
        high.frequency.value = 95;
        const air = context.createGain();
        air.gain.value = 0.075;
        breeze = context.createOscillator();
        breeze.type = 'sine';
        breeze.frequency.value = 0.075;
        breezeDepth = context.createGain();
        breezeDepth.gain.value = 0.023;
        breeze.connect(breezeDepth).connect(air.gain);
        wind.connect(low).connect(high).connect(air).connect(master);
        wind.start(); breeze.start();
        // The four stereo rustles each have three pre-mixed variations. Decode
        // off the input path; the primary rustle is playable immediately.
        const activeContext = context;
        fetch('crackle.mp3')
          .then(response => {
            if (!response.ok) throw new Error('Rustle audio unavailable');
            return response.arrayBuffer();
          })
          .then(bytes => activeContext.decodeAudioData(bytes))
          .then(buffer => { if (context === activeContext) crackles = buffer; })
          .catch(() => {});
        return true;
      } catch {
        if (context && context.close) context.close().catch(() => {});
        context = null;
        return false;
      }
    }
    function noise(time, duration, center, endCenter, level, pan = 0, attack = 0.012) {
      const voice = context.createBufferSource();
      voice.buffer = texture; voice.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass'; filter.Q.value = 0.74;
      filter.frequency.setValueAtTime(center, time);
      filter.frequency.exponentialRampToValueAtTime(endCenter, time + duration);
      const env = context.createGain();
      const peak = time + Math.min(attack, duration * 0.4);
      env.gain.setValueAtTime(0.0001,time);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), peak);
      env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      voice.connect(filter).connect(env);
      let stereo;
      if (context.createStereoPanner) {
        stereo = context.createStereoPanner();
        stereo.pan.value = pan;
        env.connect(stereo).connect(master);
      } else env.connect(master);
      voice.onended = () => {
        voice.disconnect(); filter.disconnect(); env.disconnect();
        if (stereo) stereo.disconnect();
      };
      voice.start(time,random(0,2.4));
      voice.stop(time + duration + 0.02);
    }
    function tone(time, duration, fromHz, toHz, gain) {
      const voice = context.createOscillator();
      const env = context.createGain();
      voice.type = 'sine';
      voice.frequency.setValueAtTime(fromHz,time);
      voice.frequency.exponentialRampToValueAtTime(toHz,time+duration);
      env.gain.setValueAtTime(0.0001,time);
      env.gain.exponentialRampToValueAtTime(gain,time+duration*0.23);
      env.gain.exponentialRampToValueAtTime(0.0001,time+duration);
      voice.connect(env).connect(master);
      voice.onended = () => { voice.disconnect(); env.disconnect(); };
      voice.start(time); voice.stop(time+duration+0.02);
    }
    function crackleLayer(time, slot, level) {
      if (!crackles) return;
      const slotDuration = 1.12;
      const variant = Math.floor(Math.random() * 3);
      const voice = context.createBufferSource();
      const gain = context.createGain();
      voice.buffer = crackles;
      voice.playbackRate.value = random(.97, 1.04);
      gain.gain.value = level;
      voice.connect(gain).connect(master);
      voice.onended = () => { voice.disconnect(); gain.disconnect(); };
      voice.start(time, (slot * 3 + variant) * slotDuration, slotDuration);
    }
    function planBird() {
      clearTimeout(birds);
      if (!enabled || paused || !context) return;
      birds = setTimeout(() => {
        if (!enabled || paused || !context) return;
        if (context.state === 'running') {
          const now = context.currentTime;
          const from = random(1780,2080);
          tone(now,0.12,from,from*1.25,0.014);
          tone(now+0.17,0.16,from*1.23,from*0.93,0.011);
        }
        planBird();
      }, random(11000,26000));
    }
    function sync() {
      const cycle = ++revision;
      clearTimeout(birds);
      if (enabled && !paused) {
        if (!context && !initialize()) return;
        const resumed = context.resume();
        if (resumed) resumed.catch(() => {});
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setTargetAtTime(0.65, now, 0.07);
        planBird();
      } else if (context) {
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setTargetAtTime(0, now, 0.012);
        // Leave enough time for the mute ramp before stopping the audio clock.
        setTimeout(() => {
          if (revision === cycle && (!enabled || paused)) context.suspend().catch(() => {});
        }, 80);
      }
    }
    return {
      setEnabled(value) {
        const next = Boolean(value);
        if (next === enabled && (!next || context)) return;
        enabled = next;
        sync();
      },
      suspend(value) {
        const next = Boolean(value);
        if (next === paused) return;
        paused = next;
        sync();
      },
      play(type, intensity = 0.8) {
        if (!enabled || paused || !context || context.state !== 'running') return;
        const now = context.currentTime;
        const strength = Math.max(0.12,Math.min(1,Number(intensity)||0.6));
        const level = 0.46 + strength*0.54;
        switch (type) {
          case 'rake':
          case 'sweep':
            if (now - lastRake < 0.095) return;
            lastRake = now;
            noise(now,0.23,1850,880,0.25*level,random(-0.35,0.35),0.032);
            crackleLayer(now, 0, level);
            break;
          case 'jump':
            noise(now,0.29,630,1340,0.18*level,0,0.04);
            break;
          case 'land':
          case 'landing':
            tone(now,0.18,112,58,0.12*level);
            noise(now,0.53,1850,540,0.52*level,0,0.028);
            crackleLayer(now + .025, 1, level);
            break;
          case 'toss':
            noise(now,0.51,660,2150,0.34*level,0,0.075);
            crackleLayer(now + .21, 2, level);
            break;
          case 'angel':
            noise(now,0.42,1700,820,0.24*level,-0.68,0.046);
            noise(now+0.14,0.43,1600,760,0.25*level,0.68,0.048);
            crackleLayer(now, 3, level);
            break;
        }
      }
    };
  };
})();
