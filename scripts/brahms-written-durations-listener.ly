% Brahms written-durations listener (offline exporter only).
% A Voice engraver that dumps pre-playback NoteEvent evidence plus stream
% TieEvents as per-voice JSONL. Page printing is disabled by the driver via
% -dno-print-pages; this file creates no SVG/PDF/PNG artifacts.
%
% Requires `outDir` (string, temp directory) to be defined by the wrapper
% before inclusion. One file per voice: <outDir>/voice-<id>.jsonl.
% Voice ids are set explicitly by the wrapper (rightHandUpper, etc.).
% An implicit empty-id voice (from \global in Staff) yields voice-.jsonl
% with zero lines and is ignored by the normalizer.

#(define (brahms-durations-listener context)
   (let* ((voice-id (ly:context-id context))
          (fname (string-append outDir "/voice-" voice-id ".jsonl"))
          (out-port (open-output-file fname))
          (sfname (string-append outDir "/silences-" voice-id ".jsonl"))
          (silence-port (open-output-file sfname)))
     (make-engraver
       (listeners
         ;; Round 48 — authored silences. `rest-event` is a written rest (r /
         ;; R), `skip-event` the invisible spacer (\skip / s): the source
         ;; distinguishes them and the exporter must too, because a spacer is
         ;; not a written rest and the engine may never promote one into a
         ;; visible hand-rest. One JSONL per voice, separate from the note
         ;; evidence file so the committed note fixture stays byte-identical.
         ((rest-event engraver event)
          (let* ((now (ly:context-current-moment context))
                 (cause (ly:event-property event 'music-cause))
                 (len (if (ly:music? cause) (ly:music-length cause) (ly:make-moment 0)))
                 (orig (ly:event-property event 'origin))
                 (loc (if (ly:input-location? orig)
                          (ly:input-file-line-char-column orig)
                          '("?" 0 0 0)))
                 (parent (ly:context-parent context))
                 (staff-id (catch #t
                             (lambda () (ly:context-id parent))
                             (lambda (k . args) "unknown")))
                 (score (ly:context-find context 'Score))
                 (barnum (catch #t
                           (lambda () (ly:context-property score 'currentBarNumber))
                           (lambda (k . args) 0))))
            (format silence-port "{\"type\":\"rest\",\"onsetNum\":~a,\"onsetDen\":~a,\"durNum\":~a,\"durDen\":~a,\"file\":\"~a\",\"line\":~a,\"col\":~a,\"staff\":\"~a\",\"bar\":~a}\n"
              (ly:moment-main-numerator now)
              (ly:moment-main-denominator now)
              (ly:moment-main-numerator len)
              (ly:moment-main-denominator len)
              (car loc) (cadr loc) (cadddr loc)
              staff-id barnum)))
         ((skip-event engraver event)
          (let* ((now (ly:context-current-moment context))
                 (cause (ly:event-property event 'music-cause))
                 (len (if (ly:music? cause) (ly:music-length cause) (ly:make-moment 0)))
                 (orig (ly:event-property event 'origin))
                 (loc (if (ly:input-location? orig)
                          (ly:input-file-line-char-column orig)
                          '("?" 0 0 0)))
                 (parent (ly:context-parent context))
                 (staff-id (catch #t
                             (lambda () (ly:context-id parent))
                             (lambda (k . args) "unknown")))
                 (score (ly:context-find context 'Score))
                 (barnum (catch #t
                           (lambda () (ly:context-property score 'currentBarNumber))
                           (lambda (k . args) 0))))
            (format silence-port "{\"type\":\"skip\",\"onsetNum\":~a,\"onsetDen\":~a,\"durNum\":~a,\"durDen\":~a,\"file\":\"~a\",\"line\":~a,\"col\":~a,\"staff\":\"~a\",\"bar\":~a}\n"
              (ly:moment-main-numerator now)
              (ly:moment-main-denominator now)
              (ly:moment-main-numerator len)
              (ly:moment-main-denominator len)
              (car loc) (cadr loc) (cadddr loc)
              staff-id barnum)))
         ((tie-event engraver event)
          (let ((now (ly:context-current-moment context)))
            (format out-port "{\"type\":\"tie\",\"onsetNum\":~a,\"onsetDen\":~a}\n"
              (ly:moment-main-numerator now)
              (ly:moment-main-denominator now))))
         ((note-event engraver event)
          (let* ((now (ly:context-current-moment context))
                 (cause (ly:event-property event 'music-cause))
                 (p (ly:event-property event 'pitch))
                 (len (ly:music-length cause))
                 (arts (ly:music-property cause 'articulations))
                 (has-tie
                   (if (any (lambda (a)
                              (eq? (ly:music-property a 'name) 'TieEvent))
                            arts)
                       "true" "false"))
                 (orig (ly:event-property event 'origin))
                 (loc (if (ly:input-location? orig)
                          (ly:input-file-line-char-column orig)
                          '("?" 0 0 0)))
                 (parent (ly:context-parent context))
                 (staff-id (catch #t
                             (lambda () (ly:context-id parent))
                             (lambda (k . args) "unknown")))
                 (score (ly:context-find context 'Score))
                 (barnum (catch #t
                           (lambda ()
                             (ly:context-property score 'currentBarNumber))
                           (lambda (k . args) 0)))
                 (tie-wait (catch #t
                             (lambda ()
                               (if (ly:context-property context 'tieWaitForNote)
                                   "true" "false"))
                             (lambda (k . args) "false"))))
            (format out-port "{\"type\":\"note\",\"onsetNum\":~a,\"onsetDen\":~a,\"durNum\":~a,\"durDen\":~a,\"semi\":~a,\"hasTie\":~a,\"file\":\"~a\",\"line\":~a,\"col\":~a,\"staff\":\"~a\",\"bar\":~a,\"tieWait\":~a}\n"
              (ly:moment-main-numerator now)
              (ly:moment-main-denominator now)
              (ly:moment-main-numerator len)
              (ly:moment-main-denominator len)
              (ly:pitch-semitones p)
              has-tie
              (car loc) (cadr loc) (cadddr loc)
              staff-id barnum tie-wait))))
       ((finalize engraver)
        (close-output-port out-port)
        (close-output-port silence-port)))))
