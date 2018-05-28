TEST_APP_STATE = {
    "origin": "opt-frontend.js",
    "code": "x = [1,2,3]\ny = [4,5,6]\nprint x, y",
    "textReferences": "false",
    "cumulative": "false",
    "rawInputLstJSON": "[]",
    "mode": "edit",
    "heapPrimitives": "nevernest",
    "py": "2"
}

'''
parameters needed for python:

user_script
raw_input_json:
options_json: {"cumulative_mode":false,"heap_primitives":false,"show_only_outputs":false,"origin":"opt-frontend.js"}


parameters for non-python:

user_script
options_json: {"cumulative_mode":false,"heap_primitives":false,"show_only_outputs":false,"origin":"opt-frontend.js"}

'''

import json
import requests
import sys

'http://localhost:8003/'

pyToUrl = {
    '2': 'web_exec_py2.py',
    '3': 'web_exec_py3.py',
    'js': 'exec_js_jsonp',
    'ts': 'exec_ts_jsonp',
    'java': 'exec_java_jsonp',
    'ruby': 'exec_ruby_jsonp',
    'c': 'exec_c_jsonp',
    'cpp': 'exec_cpp_jsonp',
}

# given an appState object, call the appropriate OPT backend remotely
# and return the retrieved data as a request object
def call_opt_backend(myAppState):
    py = myAppState['py']
    url = pyToUrl[py]
    if py in ('2', '3'):
        #url = 'http://localhost:8003/' + url
        url = 'http://pythontutor.com/' + url
    else:
        assert False

    if 'localhost' in url:
        print >> sys.stderr, 'WARNING: do not run untrusted user scripts on localhost'

    myParams = {'user_script': myAppState['code'],
                'raw_input_json': myAppState['rawInputLstJSON'],
                'options_json':
                    json.dumps({'cumulative_mode': myAppState['cumulative'] == 'true',
                                'heap_primitives': myAppState['heapPrimitives'] == 'true',
                                'show_only_outputs': False,
                                'origin': 'call_opt_backend.py'})
               }
    r = requests.get(url, params=myParams)
    return r
