// Python Tutor: https://github.com/pgbovine/OnlinePythonTutor/
// Copyright (C) Philip Guo (philip@pgbovine.net)
// LICENSE: https://github.com/pgbovine/OnlinePythonTutor/blob/master/LICENSE.txt

import {OptFrontendSharedSessions,TogetherJS} from './opt-shared-sessions';
import {assert,htmlspecialchars} from './pytutor';
import {footerHtml} from './footer-html';
import {eureka_survey,eureka_prompt,eureka_survey_version} from './surveys';

require('./lib/jquery-3.0.0.min.js');
require('./lib/jquery.qtip.js');
require('../css/jquery.qtip.css');

// using this library to record audio to mp3: https://github.com/Audior/Recordmp3js
require('script-loader!./lib/recordmp3.js'); // TODO: break the recorder off into its own .ts file so that this library is imported ONLY when we're recording a demo and not all the time
declare var Recorder: any; // for TypeScript

// lifted from Recordmp3js
function encode64(buffer) {
  var binary = '',
    bytes = new Uint8Array( buffer ),
    len = bytes.byteLength;

  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode( bytes[ i ] );
  }
  return window.btoa( binary );
}

/* Record/replay TODOs (from first hacking on it on 2018-01-01)

  - CRAZY bug where you can't type code in non-recording mode without it
    getting duplicated; super super bad!!!

  - test by recording locally (with python/js/etc. backends running on
    localhost) and then replaying remotely on pythontutor.com, since
    that's what students will ultimately be doing. also make a special
    entry in TogetherJS logs for tutorial replays.

  - in the video player, put a time indicator in seconds

  - to prevent weird crashes from encoding mp3's in JS itself, maybe
    simply export the raw .wav files into the JSON data file, then run a
    python script offline to compress it to mp3? that would decouple the
    tutorial recording from the compressing and also give more flexibility
    to the format
    - maybe i can just use the original record to .wav program that
      Recordmp3js forked?
      - https://github.com/mattdiamond/Recorderjs
    - i already use ffmpeg to convert my vlog/podcast audio to mp3, so i
      could adapt that into my workflow as well
    - but i do like the 100% in-browser workflow since it's nice and
      crisp; maybe up the mp3 bitrate to 96kbps?

  - refactor the code so that OptDemoVideo doesn't have to know about
    GUI elements

  - things sometimes get flaky if you *ALREADY* have code in the editor
    and then try to record a demo; sometimes it doesn't work properly.

  - in playback mode, set a more instructive username for the tutor's
    mouse pointer - and also a better and more consistent COLOR
    - #0095DD may be good (matches chat window header background)

  - minor: save UI adjustment preferences such as the width of the code
    pane or visualizer pane so that when the video replays, it will
    preserve those widths instead of always setting them back to the
    defaults, which is helpful for users with smaller monitors

  - don't send events to the togetherjs when you're in recording or
    playback mode, so as not to overwhelm the logs. also it seems
    kinda silly that you need to connect to a remote server for this
    to work, since we don't require anything from the server
    - maybe make a mock websockets interface to FAKE a connection to the
      server so that we don't need a server at all? this seems critical
      both for performance and for being able to ship tutorials as
      self-contained packages
    - or if that's too hard, then make the recorder/player a subclass of
      OptFrontendSharedSessions with a separate html file and everything
      and special frontend tag (this.originFrontendJsFile) so that we can
      diambiguate its log entries in our server logs; otherwise it will
      look like people are executing a ton of the same pieces of code when
      they're simply executing demo code (just like the iframe-embed.ts
      label)
      - also, add a special "app.startPlayingDemo" event to the
        TogetherJS logs so that we can know to FILTER OUT those log
        entries from the TogetherJS logs

  - NB: this recorder won't work well in live mode since we don't have a
    notion of an explicit "execute" event, so if you play back the trace
    too "slowly", then the live mode will auto-execute the code at weird
    unintended times and cause syntax errors and such; just use it in
    REGULAR visualize.html mode for now!

*/


// polyfill from https://gist.github.com/paulirish/1579671
//
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
//
// MIT license
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        (window as any).requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        (window as any).cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        (window as any).requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        (window as any).cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());



// TODO: pull this into its own file
// represents a list of TogetherJS events that can be replayed, paused, etc.
// within the context of the current OptFrontendSharedSessions app
class OptDemoVideo {
  frontend: OptDemoRecorder;
  initialAppState; // from getAppState()
  events = [];
  traceCache;
  isFrozen = false; // set to true after you finish recording to 'freeze'
                    // this tape and not allow any further modifications

  origIgnoreForms;  // for interfacing with TogetherJS
  fps = 30; // frames per second for setInterval-based playback

  currentFrame = 0; // for play/pause
  currentStep = 0;  // a 'step' is an index into events, whereas a 'frame' is an animation frame
  isPaused = false;  // is playback currently paused?
  rafTimerId = undefined;

  audioRecorder = null; // Recorder object from Recordmp3js

  mp3AudioRecording = null; // a data URL representing the contents of the mp3 audio (if available)
  audioElt = null; // HTML5 Audio() object

  sess; // the current live TogetherJS session object

  constructor(frontend, serializedJsonStr=null) {
    this.frontend = frontend;

    // initialize from an existing JSON string created with serializeToJSON()
    if (serializedJsonStr) {
      var obj = JSON.parse(serializedJsonStr);

      this.initialAppState = obj.initialAppState;
      this.events = obj.events;
      this.traceCache = obj.traceCache;
      this.mp3AudioRecording = obj.mp3AudioRecording;

      // VERY IMPORTANT -- set the traceCache entry of the frontend so
      // that it can actually be used. #tricky!
      // TODO: this is kind of a gross abstraction violation, eergh
      this.frontend.traceCache = this.traceCache;

      this.isFrozen = true; // freeze it!
      this.addFrameNumbers();
    }

    assert(this.frontend.audioInputStream); // must be fully initialized first
    this.audioRecorder = new Recorder(this.frontend.audioInputStream, {
      numChannels: 1,
      doneEncodingMp3Callback: this.doneEncodingMp3.bind(this),
    });
  }

  // only record certain kinds of events in the recorder
  // see ../../v3/opt_togetherjs/server.js around line 460 for all
  static shouldRecordEvent(e) {
    // do NOT record cursor-click since that's too much noise
    return ((e.type == 'form-update') ||
            (e.type == 'cursor-update') ||
            (e.type == 'app.executeCode') ||
            (e.type == 'app.updateOutput') ||
            (e.type == 'app.startRecordingDemo') ||
            (e.type == 'app.stopRecordingDemo') ||
            (e.type == 'app.aceChangeCursor') ||
            (e.type == 'app.aceChangeSelection') ||
            (e.type == 'pyCodeOutputDivScroll') ||
            (e.type == 'app.hashchange'));
  }

  addEvent(msg) {
    assert(!this.isFrozen);
    msg.ts = new Date().getTime(); // augment with timestamp
    msg.peer = {color: "#8d549f"}; // fake just enough of a peer object for downstream functions to work
    msg.sameUrl = true;
    if (OptDemoVideo.shouldRecordEvent(msg)) {
      this.events.push(msg);
    }
  }

  // do this BEFORE TogetherJS gets initialized
  startRecording() {
    assert(!this.isFrozen);
    assert(!TogetherJS.running);
    this.frontend.traceCacheClear();
    this.initialAppState = this.frontend.getAppState();
    // cache the current trace if we're in display mode
    if (this.initialAppState.mode == "display") {
      this.frontend.traceCacheAdd();
    }

    this.frontend.isRecordingDemo = true;
    TogetherJS.config('isDemoSession', true);
    TogetherJS(); // activate TogetherJS as the last step to start the recording
  }

  // this is run as soon as TogetherJS is ready in recording mode
  recordTogetherJsReady() {
    assert(TogetherJS.running && this.frontend.isRecordingDemo && !this.frontend.isPlayingDemo);

    // set the TogetherJS eventRecorderFunc to this.demoVideo.addEvent
    // (don't forget to bind it as 'this', ergh!)
    TogetherJS.config('eventRecorderFunc', this.addEvent.bind(this));

    // start recording audio only after TogetherJS is ready and
    // eventRecorderFunc has been set so that it can log the event:
    this.startRecordingAudio();

    TogetherJS.send({type: "startRecordingDemo"}); // special start marker, to coincide with when audio starts recording
  }

  stopRecording() {
    assert(!this.isFrozen);
    this.traceCache = this.frontend.traceCache;
    this.isFrozen = true; // freeze it!
    this.addFrameNumbers();

    this.frontend.isRecordingDemo = false;
    TogetherJS.config('isDemoSession', false);
    TogetherJS.config('eventRecorderFunc', null);

    this.stopRecordingAudio(); // it will still take some time before the encoded mp3 data is ready and doneEncodingMp3 is called!
  }

  doneEncodingMp3(mp3Data) {
    console.log('doneEncodingMp3!!!');
    var dataUrl = 'data:audio/mp3;base64,'+encode64(mp3Data);
    this.mp3AudioRecording = dataUrl;

    //(localStorage as any).demoVideo = this.serializeToJSON(); // serialize 'this' after audio is ready

    // create a download link
    let hf = document.createElement('a');
    // serialize 'this' into a JSON string and turn it into a data URL:
    hf.href = URL.createObjectURL(new Blob([this.serializeToJSON()], {type : 'application/json'}));
    // set download filename based on timestamp:
    (hf as any).download = 'codcast_' + (new Date().toISOString()) + '.json';
    hf.innerHTML = 'Download recording';
    (document.getElementById('headerTdLeft') as any).append(hf);
    // disable auto-download, since it's kind of annoying and hidden
    //hf.click(); // automatically click to download the recording as a file
  }

  // lifted from Recordmp3js
  startRecordingAudio() {
    assert(this.audioRecorder);
    console.warn('startRecordingAudio()');
    this.mp3AudioRecording = null; // erase any existing audio data
    this.audioRecorder.record();
  }

  stopRecordingAudio() {
    assert(this.audioRecorder);
    console.warn('stopRecordingAudio()');
    this.audioRecorder.stop();

    this.audioRecorder.exportWAV(function(blob) {
      console.log('calling audioRecorder.exportWAV');
    });

    this.audioRecorder.clear();
  }


  setInitialAppState() {
    assert(this.initialAppState);
    this.frontend.pyInputSetValue(this.initialAppState.code);
    this.frontend.setToggleOptions(this.initialAppState);

    if (this.initialAppState.mode == 'display') {
      // we *should* get a cache hit in traceCache so this won't go to the server
      this.frontend.executeCode(this.initialAppState.curInstr);
    } else {
      assert(this.initialAppState.mode == 'edit');
      this.frontend.enterEditMode();
    }

    this.currentFrame = 0;
    this.currentStep = 0;

    // OK this is super subtle but important. you want to call setInit
    // defined deep in the bowels of lib/togetherjs/togetherjs/togetherjsPackage.js
    // why are we calling it right now? because we need to clear the
    // edit history that TogetherJS captures to start us over with a
    // clean slate so that we can start replaying events from the start
    // of the trace. otherwise form-update events in the Ace editor
    // won't work. we need setInit since it's *synchronous* and executes
    // instantly rather than waiting on an async event queue.
    var setInit = TogetherJS.config.get('setInit');
    setInit();
  }

  startPlayback() {
    assert(this.isFrozen);
    assert(!TogetherJS.running); // do this before TogetherJS is initialized
    assert(this.mp3AudioRecording); // audio must be initialized before you start playing

    // save the original value of ignoreForms
    this.origIgnoreForms = TogetherJS.config.get('ignoreForms');
    // set this to true, which will have TogetherJS ignore ALL FORM
    // EVENTS, which means that it will ignore events fired on the Ace
    // editor (which are form-update events or somethin') ... if we
    // don't do that, then spurious events will get fired durin playback
    // and weird stuff will happen
    TogetherJS.config('ignoreForms', true);

    this.frontend.isPlayingDemo = true;
    TogetherJS.config('isDemoSession', true);
    TogetherJS(); // activate TogetherJS as the last step to start playback mode
  }

  // set a timer to play in real time starting at this.currentFrame
  playFromCurrentFrame() {
    assert(TogetherJS.running && this.frontend.isPlayingDemo);
    var totalFrames = this.getTotalNumFrames();
    // if we're at the VERY end, then loop back to the very beginning
    if (this.currentFrame >= totalFrames) {
      this.setInitialAppState();
    }

    var startingFrame = this.currentFrame;

    // play the first N steps to get up to right before this.currentFrame
    // TODO: it's kinda klunky to convert "video" frames to steps, which
    // which are actually indices into this.events
    if (startingFrame > 0) {
      var step = this.frameToStepNumber(startingFrame);
      this.playFirstNSteps(step);
    }


    // handle audio
    assert(this.mp3AudioRecording);

    // always create a new element each time to avoid stale old ones
    // being stuck at weird seek positions
    this.audioElt = new Audio();
    this.audioElt.src = this.mp3AudioRecording;
    this.audioElt.currentTime = this.frameToSeconds(startingFrame);
    this.audioElt.play();
    console.log('playFromCurrentFrame', startingFrame, 'totalFrames', totalFrames, 'currentTime:', this.audioElt.currentTime, this.audioElt.ended);

    var starttime = -1;
    var rafHelper = (timestamp) => {
      assert(this.audioElt); // we will always synchronize with the audio, so if you don't have audio, it's a dealbreaker
      if (this.isPaused) {
        return;
      }

      // keep going until your audio dies:
      if (!this.audioElt.ended) {
        this.rafTimerId = requestAnimationFrame(rafHelper);

        // always use the latest values of this.audioElt.currentTime to
        // calculate the current frame so that we can try to keep the
        // audio and animation in sync as much as possible:
        let frameNum = this.secondsToFrames(this.audioElt.currentTime);
        this.currentFrame = frameNum;

        //console.log('audioElt.currentTime:', this.audioElt.currentTime, frameNum, totalFrames, this.audioElt.ended);

        // TODO: this is an abstraction violation since OptDemoVideo
        // shouldn't know about #timeSlider, which is part of the GUI!
        // (maybe tunnel this through a callback?)
        $("#timeSlider").slider("value", frameNum); // triggers slider 'change' event
      } else {
        // set currentFrame and slider to the very end for consistency
        this.currentFrame = totalFrames;
        $("#timeSlider").slider("value", totalFrames);

        this.frontend.setPlayPauseButton('paused');
      }
    }

    // kick it off!
    this.isPaused = false; // unpause me!
    this.rafTimerId = requestAnimationFrame((timestamp) => {
      starttime = timestamp;
      rafHelper(timestamp);
    });

    this.frontend.pyInputAceEditor.setReadOnly(true); // don't let the user edit code when demo is playing
  }

  pause() {
    assert(TogetherJS.running && this.frontend.isPlayingDemo);
    this.isPaused = true;
    console.log('pause: currentFrame:', this.currentFrame);
    if (this.rafTimerId) {
      cancelAnimationFrame(this.rafTimerId);
      this.rafTimerId = undefined;
    }

    if (this.audioElt) {
      this.audioElt.pause();
      // kill it and start afresh each time to (hopefully) avoid out of sync issues
      this.audioElt.src = '';
      this.audioElt = null;
    }
    this.frontend.pyInputAceEditor.setReadOnly(false); // let the user edit code when paused
  }

  // this is run as soon as TogetherJS is ready in playback mode
  playbackTogetherJsReady() {
    assert(TogetherJS.running && this.frontend.isPlayingDemo && !this.frontend.isRecordingDemo);

    // initialize the session here
    this.sess = TogetherJS.require("session");

    // STENT for debugging only
    (window as any).demoVideo = this;

    this.setInitialAppState(); // reset app state to the initial one
  }

  playEvent(msg) {
    assert(this.sess && this.frontend.isPlayingDemo);
    //this.frontend.pyInputAceEditor.resize(true);

    // seems weird but we need both session.hub.emit() and
    // TogetherJS._onmessage() in order to gracefully handle
    // both built-in TogetherJS events and custom OPT app events:
    // copied-pasted from lib/togetherjs/togetherjs/togetherjsPackage.js
    // around line 1870
    try {
      this.sess.hub.emit(msg.type, msg);
    } catch (e) {
      console.warn(e);
      // let it go! let it go!
    }

    try {
      TogetherJS._onmessage(msg);
    } catch (e) {
      console.warn(e);
      // let it go! let it go!
    }

    // however, TogetherJS._onmessage mangles up the type fields
    // (UGH!), so we need to restore them back to their original
    // form to ensure idempotence. copied from session.appSend()
    var type = msg.type;
    if (type.search(/^togetherjs\./) === 0) {
      type = type.substr("togetherjs.".length);
    } else if (type.search(/^app\./) === -1) {
      type = "app." + type;
    }
    msg.type = type;
  }

  playStep(i: number) {
    assert(i >= 0 && i < this.events.length);
    this.playEvent(this.events[i]);
    this.currentStep = i; // very important!!!
  }

  // play all steps from [lower, upper], inclusive
  playStepRange(lower: number, upper: number) {
    //console.log('playStepRange', lower, upper, 'curStep:', this.currentStep);
    assert(lower <= upper);
    for (var i = lower; i <= upper; i++) {
      this.playStep(i);
    }
  }

  // this method *instantaneously* plays all steps from 0 to n
  // (so everything it calls should work SYNCHRONOUSLY ...
  //  if there's async code in its callee chain, something will probably break)
  playFirstNSteps(n: number) {
    //console.log('playFirstNSteps', n, 'curStep', this.currentStep, 'curFrame', this.currentFrame);
    assert(this.isFrozen);
    assert(TogetherJS.running && this.frontend.isPlayingDemo);
    assert(n >= 0 && n < this.events.length);
    this.setInitialAppState(); // reset app state to the initial one

    // go up to n, inclusive!
    for (var i = 0; i <= n; i++) {
      this.playStep(i);
    }
  }

  // given a frame number, convert it to the step number (i.e., index in
  // this.events) that takes place right BEFORE that given frame.
  frameToStepNumber(n) {
    assert(this.isFrozen && this.events[0].frameNum);
    var foundIndex = -1;
    for (var i = 0; i < this.events.length; i++) {
      if (n < this.events[i].frameNum) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex < 0) {
      return this.events.length - 1;
    } else if (foundIndex == 0) {
      return 0; // TODO: kinda weird that we return 0 for foundIndex being 0 or 1
    } else {
      return foundIndex - 1; // subtract 1 to get the step right BEFORE the found one
    }
  }

  jumpToFrame(frame) {
    assert(this.currentStep >= 0);
    var step = this.frameToStepNumber(frame);

    // avoid unnecessary calls
    if (step == this.currentStep) {
      // do nothing! pass thru
    } else if (step > this.currentStep) {
      // as an optimization, simply play ahead from the current step
      // rather than playing all steps from 0 to step again from scratch
      this.playStepRange(this.currentStep + 1, step);
    } else {
      // if we're stepping backwards, then we have no choice but to
      // play everything from scratch because we can't "undo" actions
      assert(step >= 0 && step < this.currentStep);
      this.playFirstNSteps(step);
    }
    this.currentFrame = frame; // do this at the VERY END after all the dust clears
  }


  stopPlayback() {
    this.sess = null;
    this.frontend.isPlayingDemo = false;
    TogetherJS.config('ignoreForms', this.origIgnoreForms); // restore its original value
    TogetherJS.config('isDemoSession', false);
    TogetherJS.config('eventRecorderFunc', null);
  }

  // serialize the current state to JSON:
  serializeToJSON() {
    assert(this.isFrozen);

    var ret = {initialAppState: this.initialAppState,
               events: this.events,
               traceCache: this.traceCache,
               mp3AudioRecording: this.mp3AudioRecording};
    return JSON.stringify(ret);
  }

  getFrameDiff(a, b) {
    assert(a <= b);
    return Math.floor(((b - a) / 1000) * this.fps);
  }

  // add a frameNum field for each entry in this.events
  addFrameNumbers() {
    assert(this.isFrozen && this.events.length > 0);
    var firstTs = this.events[0].ts;
    for (var i = 0; i < this.events.length; i++) {
      var elt = this.events[i];
      // add 1 so that the first frameNum starts at 1 instead of 0
      elt.frameNum = this.getFrameDiff(firstTs, elt.ts) + 1;
    }
  }

  // how many frames should there be in the animation?
  getTotalNumFrames() {
    assert(this.isFrozen && this.events.length > 0);

    var firstTs = this.events[0].ts;
    var lastTs = this.events[this.events.length-1].ts;

    return this.getFrameDiff(firstTs, lastTs);

    // add 1 at the end for extra padding
    // NIX THIS!!!
    //return this.getFrameDiff(firstTs, lastTs) + 1;
  }

  secondsToFrames(secs) {
    return Math.floor(secs * this.fps);
  }

  frameToSeconds(frame) {
    return frame / this.fps;
  }
}


export class OptDemoRecorder extends OptFrontendSharedSessions {
  // TODO: test to see if this works
  originFrontendJsFile: string = 'recorder.ts';

  // for demo recording:
  isRecordingDemo = false;
  isPlayingDemo = false;
  demoVideo: OptDemoVideo;
  audioInputStream = null;

  Range; // reference to imported Ace Range() object -- ergh

  constructor(params={}) {
    super(params);

    // disable all surveys:
    this.activateSyntaxErrorSurvey = false;
    this.activateRuntimeErrorSurvey = false;
    this.activateEurekaSurvey = false;

    //window.pyInputAceEditor = this.pyInputAceEditor; // STENT for debugging

    var queryStrOptions = this.getQueryStringOptions();
    // TRICKY: call superclass's parseQueryString ONLY AFTER initializing optTests
    super.parseQueryString();


    this.disableSharedSessions = true; // don't call getHelpQueue periodically

    // always use a localhost server for recording so that we don't
    // pollute the real server logs
    TogetherJS._defaultConfiguration.hubBase = 'http://localhost:30035/';

    var recordReplayDiv = `
      <button id="recordBtn" type="button" class="togetherjsBtn" style="font-size: 9pt;">
      Record demo
      </button>

      <br/>
      <button id="playbackBtn" type="button" class="togetherjsBtn" style="font-size: 9pt;">
      Play recording
      </button>`;
    $("td#headerTdLeft").html(recordReplayDiv); // clobber the existing contents

    $("#recordBtn").click(this.recordButtonClicked.bind(this));
    $("#playbackBtn").click(this.startPlayback.bind(this));


    // NB: note that we DON'T have multiple cursors or selections like
    // in Google Docs, so activating this feature might lead to some
    // confusion as there is only *one* cursor/selection that multiple
    // users might be fighting over. (in contrast, there are multiple
    // mouse cursors.)
    this.pyInputAceEditor.selection.on("changeCursor", this.cursorOrSelectionChanged.bind(this));
    this.pyInputAceEditor.selection.on("changeSelection", this.cursorOrSelectionChanged.bind(this));


    this.Range = ace.require('ace/range').Range; // for Ace Range() objects

    // BEGIN - lifted from Recordmp3js
    var audio_context;

    try {
      // webkit shim
      (window as any).AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      (navigator as any).getUserMedia = ( (navigator as any).getUserMedia ||
                       (navigator as any).webkitGetUserMedia ||
                       (navigator as any).mozGetUserMedia ||
                       (navigator as any).msGetUserMedia);
      (window as any).URL = (window as any).URL || (window as any).webkitURL;

      audio_context = new AudioContext;
      console.warn('Audio context set up.');
      //console.warn('navigator.getUserMedia ' + (navigator.getUserMedia ? 'available.' : 'not present!'));
    } catch (e) {
      alert('ERROR: no web audio support in this browser!');
    }

    (navigator as any).getUserMedia({audio: true},
      // success:
      (stream) => {
        this.audioInputStream = audio_context.createMediaStreamSource(stream);
        console.warn('Media stream created.' );
        console.warn("input sample rate " + this.audioInputStream.context.sampleRate);
        console.warn('Input connected to audio context destination.');
      },
      // failure:
      (e) => {
          alert('ERROR: No live audio input: ' + e);
      }
    );
    // END - lifted from Recordmp3js
  }

  cursorOrSelectionChanged(e) {
    if (e.type === 'changeCursor') {
      let c = this.pyInputAceEditor.selection.getCursor();
      //console.log('changeCursor', c);
      TogetherJS.send({type: "aceChangeCursor",
                       row: c.row, column: c.column});
    } else if (e.type === 'changeSelection') {
      let s = this.pyInputAceEditor.selection.getRange();
      //console.log('changeSelection', s);
      TogetherJS.send({type: "aceChangeSelection",
                       start: s.start, end: s.end});
    } else {
      // fail soft
      console.warn('cursorOrSelectionChanged weird type', e.type);
    }
  }

  // override to be a NOP
  takeFullCodeSnapshot() {
    return;
  }

  parseQueryString() {
    super.parseQueryString();
  }

  recordButtonClicked() {
    if ($("#recordBtn").data('status') === 'recording') {
      // issue this event right before stopping the recording
      TogetherJS.send({type: "stopRecordingDemo"});

      TogetherJS(); // this will stop recording
      $("#recordBtn").data('status', 'stopped');
      $("#recordBtn").html("Record demo");
    } else {
      $("#ssDiv,#surveyHeader").hide(); // hide ASAP!
      $("#togetherjsStatus").html("Recording now ...");

      this.demoVideo = new OptDemoVideo(this);
      this.demoVideo.startRecording();

      $("#recordBtn").data('status', 'recording');
      $("#recordBtn").html("Stop recording");
    }
  }

  setPlayPauseButton(state) {
    var me = $("#demoPlayBtn");
    if (state == 'playing') {
      me.data('status', 'playing')
      me.html('Pause');
      this.demoVideo.playFromCurrentFrame();
    } else {
      assert(state == 'paused');
      me.data('status', 'paused')
      me.html('Play');
      this.demoVideo.pause();
    }
  }

  startPlayback() {
    $("#ssDiv,#surveyHeader").hide(); // hide ASAP!

    $("#togetherjsStatus").html(`<div><button id="demoPlayBtn">Play</button></div>
                                  <div style="margin-top: 10px;" id="timeSlider"/>`);

    // temp. test for debugging only! load an existing video from localStorage
    if (!this.demoVideo) {
      var savedVideoJson = (localStorage as any).demoVideo;
      if (savedVideoJson) {
        this.demoVideo = new OptDemoVideo(this, savedVideoJson);
      }
    }

    assert(this.demoVideo);

    $("#demoPlayBtn").data('status', 'paused');
    $("#demoPlayBtn").click(() => {
      var me = $("#demoPlayBtn");
      if (me.data('status') == 'paused') {
        this.setPlayPauseButton('playing');
      } else {
        assert(me.data('status') == 'playing');
        this.setPlayPauseButton('paused');
      }
    });

    var timeSliderDiv = $('#timeSlider');
    timeSliderDiv.css('width', '700px');

    var interruptedPlaying = false; // did we yank the slider while the video was playing?

    var totalNumFrames = this.demoVideo.getTotalNumFrames();

    timeSliderDiv.slider({
      min: 0,
      max: totalNumFrames,
      step: 1,

      // triggers only when the user *manually* slides, *not* when the
      // value has been changed programmatically
      slide: (evt, ui) => {
        if (this.demoVideo.rafTimerId) {
          // emulate YouTube by 'jumping' to the given frame and
          // pausing, then resuming playback when you let go (see
          // 'change' event handler)
          this.demoVideo.pause();
          interruptedPlaying = true;
        }
        this.demoVideo.jumpToFrame(ui.value);
      },

      // triggers both when user manually finishes sliding, and also
      // when the slider's value is set programmatically
      change: (evt, ui) => {
        // this is SUPER subtle. if this value was changed programmatically,
        // then evt.originalEvent will be undefined. however, if this value
        // was changed by a user-initiated event, then this code should be
        // executed ...
        if ((evt as any).originalEvent) {
          // slider value was changed by a user interaction; only do
          // something special if interruptedPlaying is on, in which
          // case resume playback. this happens AFTER a user-initiated
          // 'slide' event is done:
          if (interruptedPlaying) {
            // literally an edge case -- if we've slid to the VERY END,
            // don't resume playing since that will wrap back around to
            // the beginning
            if (ui.value < totalNumFrames) {
              this.demoVideo.playFromCurrentFrame();
            } else {
              // if we've slide the slider to the very end, pause it!
              this.setPlayPauseButton('paused');
            }
            interruptedPlaying = false;
          }
        } else {
          // slider value was changed programmatically, so we're
          // assuming that requestAnimationFrame has been used to schedule
          // periodic changes to the slider
          this.demoVideo.jumpToFrame(ui.value);
        }
      }
    });

    // disable keyboard actions on the slider itself (to prevent double-firing
    // of events), and make skinnier and taller
    timeSliderDiv
      .find(".ui-slider-handle")
      .unbind('keydown')
      .css('width', '0.6em')
      .css('height', '1.5em');


    this.demoVideo.startPlayback(); // do this last
  }

  finishSuccessfulExecution() {
    assert (this.myVisualizer);

    if (this.isRecordingDemo) {
      this.traceCacheAdd(); // add to cache only if we're recording a demo
    }

    // do this last
    super.finishSuccessfulExecution();
  }

  handleUncaughtException(trace: any[]) {
    super.handleUncaughtException(trace); // do this first

    // do this even if execution fails
    if (this.isRecordingDemo) {
      this.traceCacheAdd(); // add to cache only if we're recording a demo
    }
  }

  initTogetherJS() {
    super.initTogetherJS();

    // TODO: move these into opt-shared-sessions.ts when we're ready

    TogetherJS.hub.on("aceChangeCursor", (msg) => {
      //console.warn('TogetherJS.hub.on("aceChangeCursor"', msg.row, msg.column);
      this.pyInputAceEditor.selection.moveCursorTo(msg.row, msg.column,
                                                   false /* keepDesiredColumn */);
    });

    TogetherJS.hub.on("aceChangeSelection", (msg) => {
      //console.warn('TogetherJS.hub.on("aceChangeSelection"', msg.start, msg.end);
      this.pyInputAceEditor.selection.setSelectionRange(
        new this.Range(msg.start.row, msg.start.column, msg.end.row, msg.end.column),
        false /* reverse */
      );
    });
  }

  TogetherjsReadyHandler() {
    //$("#surveyHeader").hide();
    if (this.isRecordingDemo) {
      this.demoVideo.recordTogetherJsReady();
    } else if (this.isPlayingDemo) {
      this.demoVideo.playbackTogetherJsReady();
    } else {
      assert(false);
    }
  }

  TogetherjsCloseHandler() {
    super.TogetherjsCloseHandler();

    // reset all recording-related stuff too!
    if (this.isRecordingDemo) {
      this.demoVideo.stopRecording();
      assert(!this.isRecordingDemo);
    }
    if (this.isPlayingDemo) {
      this.demoVideo.stopPlayback();
      assert(!this.isPlayingDemo);
    }
  }

} // END Class OptDemoRecorder


$(document).ready(function() {
  // initialize all HTML elements before creating optFrontend object
  $("#footer").append(footerHtml);

  var params = {};
  var optFrontend = new OptDemoRecorder(params);

  $('#pythonVersionSelector').change(optFrontend.setAceMode.bind(optFrontend));
  optFrontend.setAceMode();
});
