% Offline layout-tag expression witness. Installed in each authored Voice and
% each named Dynamics context; no grobs or output pages are produced.
#(define (brahms-expression-listener context)
   (let* ((id (ly:context-id context))
          (port (open-output-file (string-append outDir "/expression-" id ".jsonl"))))
     (define (emit kind event)
       (let* ((now (ly:context-current-moment context))
              (orig (ly:event-property event 'origin))
              (loc (if (ly:input-location? orig)
                       (ly:input-file-line-char-column orig) '("?" 0 0 0)))
              (name (ly:event-property event 'name))
              (text (ly:event-property event 'text))
              (dir (ly:event-property event 'span-direction))
              (span (ly:event-property event 'span-type))
              (score (ly:context-find context 'Score))
              (bar (ly:context-property score 'currentBarNumber)))
         (format port "{\"kind\":\"~a\",\"name\":\"~a\",\"text\":\"~a\",\"direction\":\"~a\",\"span\":\"~a\",\"num\":~a,\"den\":~a,\"file\":\"~a\",\"line\":~a,\"col\":~a,\"bar\":~a}\n"
           kind name text dir span (ly:moment-main-numerator now)
           (ly:moment-main-denominator now) (car loc) (cadr loc) (cadddr loc) bar)))
     (make-engraver
       (listeners
         ((absolute-dynamic-event engraver event) (emit "dynamic" event))
         ((crescendo-event engraver event) (emit "crescendo" event))
         ((decrescendo-event engraver event) (emit "decrescendo" event))
         ((sustain-event engraver event) (emit "sustain" event)))
       ((finalize engraver) (close-output-port port)))))
