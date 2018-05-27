# this script converts a codechella session log recorded by
# ../../v3/opt_togetherjs/server.js
#
# and turns it into the codcast format, which is readable by
# ../js/recorder.ts and ../js/demovideo.ts

# created: 2018-05-27

# HUGE WARNING: DO NOT RUN THIS ON UNTRUSTED CODE YET, SINCE IT WILL
# SIMPLY EXECUTE THE CODE VERBATIM TO GENERATE TRACES FOR THE CACHE; IF
# THE CODE IS MALICIOUS, THEN IT WILL POSSIBLY HARM YOUR COMPUTER!!!

'''

NB: one big challenge is that some types of events are duplicated (or
repeated N times if there are N people in the session) since TogetherJS
logs everyone's actions separately
- app.editCode events are DEFINITELY duplicated

UGH there's also a stray app.editCode whenever someone FIRST ENTERS A
SESSION, which may not match prior editCode events of people who were
previously in the session, so we need to account for that

TODOs:
- not sure how much hashchange events matter

'''

import dateutil.parser
import json
import os
import sys
import time

print >> sys.stderr, 'WARNING: do not run this on a trace containing untrusted code'

# somewhat modeled after ../js/demovideo.ts
ALL_LEGIT_TYPES = (
    'app.initialAppState',
    'hello',
    'peer-update',
    'form-update',
    'cursor-update',
    'chat',
    'app.editCode',
    'app.executeCode',
    'app.updateOutput',
    'app.aceChangeCursor',
    'app.aceChangeSelection',
    'pyCodeOutputDivScroll',
    'app.hashchange',
)

# TODO: maybe we don't need this since TogetherJS will take care of
# mapping clientId's to usernames for us ...
#
# Key: clientId, Value: current username (might change throughout the
# session; keep the latest one)
clientIdtoUsername = {}

firstInitialAppState = None
raw_events = []
lastEditCodeEvent = None

for line in open(sys.argv[1]):
    rec = json.loads(line)
    if rec['type'] != 'togetherjs':
        continue
    
    tjs = rec['togetherjs']
    typ = tjs['type']
    if typ not in ALL_LEGIT_TYPES:
        continue

    # read only the FIRST initialAppState since we'll assume that's who
    # initiated the session
    if not firstInitialAppState and typ == 'app.initialAppState':
        firstInitialAppState = rec

    # don't append any initialAppState events:
    if typ == 'app.initialAppState':
        continue

    # OK this is kinda tricky. if the most recent app.editCode
    # event has an identical delta, then DISCARD THIS EVENT since
    # it's redundant with the prior one. the reason why we keep the
    # prior one and NOT this one is because that was the FIRST person
    # who initiated that code edit, so we want to credit them properly.
    if typ == 'app.editCode' and lastEditCodeEvent:
        if tjs['delta']['d'] == lastEditCodeEvent['togetherjs']['delta']['d']:
            assert tjs['delta']['t'] >= lastEditCodeEvent['togetherjs']['delta']['t']
            continue # get outta here!

    raw_events.append(rec)
    if typ == 'app.editCode':
        lastEditCodeEvent = rec


events = []
firstClientId = firstInitialAppState['togetherjs']['clientId']
clientIdsWhereFirstEditRemoved = set()

for e in raw_events:
    # OK this is even more tricky: when someone who didn't initiate the
    # session first enters that session, they get an app.editCode event
    # saying that there's been a potentially-large diff containing the
    # current contents of the entire text buffer. we want to IGNORE that
    # first app.editCode event from that user.
    if e['togetherjs']['type'] == 'app.editCode':
        cid = e['togetherjs']['clientId']
        if cid != firstClientId and cid not in clientIdsWhereFirstEditRemoved:
            clientIdsWhereFirstEditRemoved.add(cid)
            continue # skip!!!

    # clean up and append to final events
    dt = dateutil.parser.parse(e['date'])
    # get timestamp in milliseconds
    ms = int(time.mktime(dt.timetuple())) * 1000

    # add these fields to match codcast format
    e['togetherjs']['ts'] = ms
    e['togetherjs']['sameUrl'] = True
    e['togetherjs']['peer'] = {'color': '#8d549f'} # not sure if this is necessary
    # TODO: we need to add frameNum field later on; or maybe just add it here?!?

    events.append(e['togetherjs']) # just take the togetherjs part


for e in events:
    print json.dumps(e)
