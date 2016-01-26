"""Flask application for serving poolvr.
"""
import os
import logging
_logger = logging.getLogger(__name__)
import json
from copy import deepcopy
import sys

from flask import Flask, render_template, request, Markup, jsonify
STATIC_FOLDER = os.path.abspath(os.path.join(os.path.split(__file__)[0], os.path.pardir))
app = Flask(__name__,
            static_folder=STATIC_FOLDER,
            static_url_path='')

sys.path.insert(0, os.path.join(os.path.split(__file__)[0], os.path.pardir))
import pyserver.site_settings as site_settings
app.config.from_object(site_settings)

import pyserver.pool_table as pool_table

WRITE_FOLDER = os.path.join(STATIC_FOLDER, 'saves')

POOLVR = {
    'config': {
        'pyserver'           : True,
        'gravity'            : 9.8,
        'useWebVRBoilerplate': True,
        'useBasicMaterials'  : True,
        'useShadowMap'       : False,
        'usePointLight'      : False,
        'useSkybox'          : True,
        'useTextGeomLogger'  : True,
        'L_table'            : 2.3368,
        'H_table'            : 0.74295,
        'ball_diameter'      : 2.25 * pool_table.IN2METER,
        'initialPosition'    : [0, 0.98295, 1.0042],
        'synthSpeakerVolume' : 0.3,
        'toolOptions': {
            'toolOffset'  : [0, -0.42, -0.4],
            'toolRotation': 0,
            'tipShape'    : 'Cylinder'
        }
    },
    'version': '0.1.0'
}



def get_poolvr_config():
    """
    Constructs poolvr config dict based on request url parameters.
    """
    config = deepcopy(POOLVR['config'])
    filename = request.args.get('file')
    if filename:
        try:
            with open(os.path.join(WRITE_FOLDER, filename)) as f:
                config.update(json.loads(f.read()))
        except Exception as err:
            _logger.warning("could not load requested configuration:")
            _logger.warning(err);
    args = dict({k: v for k, v in request.args.items()
                 if k in config})
    # TODO: better way
    for k, v in args.items():
        if v == 'false':
            args[k] = False
        elif v == 'true':
            args[k] = True
        elif not (v is False or v is True or v is None):
            try:
                args[k] = float(v)
            except Exception as err:
                pass
    config.update(args)
    if config.get('useShadowMap'):
        config['useBasicMaterials'] = False
    return config



@app.context_processor
def js_suffix():
    if app.debug:
        return {'js_suffix': '.js'}
    else:
        return {'js_suffix': '.min.js'}



@app.route('/poolvr')
def poolvr_app():
    """
    Serves the poolvr app HTML.
    """
    config = get_poolvr_config()
    return render_template("poolvr.html",
                           json_config=Markup(r"""<script>
var POOLVR = %s;
var JSON_SCENE = %s;
</script>""" % (json.dumps({'config' : config,
                            'version': POOLVR['version']},
                           indent=2),
                json.dumps(pool_table.pool_hall(**config).export(),
                           indent=(2 if app.debug else None)))), **config)



@app.route('/log', methods=['POST'])
def log():
    """
    Post message from client to the server log
    """
    msg = request.form['msg']
    _logger.info(msg)
    response = {'status': 0}
    return jsonify(response)



@app.route("/write", methods=['POST'])
def write():
    if not os.path.exists(WRITE_FOLDER):
        _logger.warning('write is disabled, you need to create the write folder %s' % WRITE_FOLDER)
        return jsonify({'error': 'write is disabled'})

    filename = os.path.join(WRITE_FOLDER, os.path.split(request.args['file'])[1])
    try:
        if request.json is not None:
            with open(filename, 'w') as f:
                f.write(json.dumps(request.json,
                                   indent=2, sort_keys=True))
        else:
            with open(filename, 'w') as f:
                f.write(request.form['text'])
        response = {'filename': filename}
        _logger.info('wrote %s' % filename)
    except Exception as err:
        response = {'error': str(err)}
        _logger.warning('could not write %s' % filename)
    return jsonify(response)



def main():
    _logger.info("app.config =\n%s" % '\n'.join(['%s: %s' % (k, str(v))
                                                for k, v in sorted(app.config.items(),
                                                                   key=lambda i: i[0])]))
    _logger.info("""
          ***********
          p o o l v r
   *************************
*******************************
STARTING FLASK APP!!!!!!!!!!!!!
*******************************
   *************************
          p o o l v r
          ***********
""")
    app.run(host='0.0.0.0', port=app.config['PORT'])



if __name__ == "__main__":
    logging.basicConfig(level=(logging.DEBUG if app.debug else logging.INFO),
                        format="%(asctime)s %(levelname)s %(name)s %(funcName)s %(lineno)d:  %(message)s")
    main()
