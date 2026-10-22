"""Faux serveur Supabase pour les tests : Auth + PostgREST (sous-ensemble) + RPC,
au-dessus d'un vrai Postgres local, avec la sécurité ligne par ligne réellement appliquée."""
import json, subprocess, sys, uuid, re, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

KEY = 'test-anon-key-0123456789abcdef'
PG = ['psql', '-h', '/tmp/pgtest', '-p', '54329', '-U', 'postgres', '-d', 'eco', '-At', '-q', '-v', 'ON_ERROR_STOP=1']
TOKENS = {}      # access -> uid
REFRESH = {}     # refresh -> uid
LOG = []
lock = threading.Lock()
CONFIRM_EMAIL = '--confirm' in sys.argv
PENDING_MODE = ['--pending-email' in sys.argv]
PENDING = {}     # uid -> nouvelle adresse en attente de confirmation (simulation)

def lit(s):
    return "'" + str(s).replace("'", "''") + "'"

def run(sql, uid=None):
    pre = "\\set VERBOSITY verbose\nbegin;\n"
    if uid:
        pre += "set local role authenticated;\nselect set_config('request.jwt.claims', %s, true) \\g /dev/null\n" % lit(json.dumps({'sub': uid}))
    r = subprocess.run(PG, input=pre + sql + ";\ncommit;\n", capture_output=True, text=True)
    if r.returncode != 0:
        m = re.search(r'ERROR:\s+([0-9A-Z]{5}):\s*(.*)', r.stderr)
        code, msg = (m.group(1), m.group(2).strip()) if m else ('XX000', r.stderr.strip())
        raise PgErr(code, msg)
    out = r.stdout.strip()
    return out or None

class PgErr(Exception):
    def __init__(self, code, msg): self.code, self.msg = code, msg

SETOF = {'my_teams', 'team_members'}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer, x-client-info')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    def reply(self, code, obj=None):
        body = b'' if obj is None else json.dumps(obj).encode()
        self.send_response(code); self.cors()
        if body: self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body))); self.end_headers()
        if body: self.wfile.write(body)
    def do_OPTIONS(self): self.reply(204)
    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'null') if n else None
    def uid(self):
        a = self.headers.get('Authorization', '')
        tok = a[7:] if a.startswith('Bearer ') else ''
        return TOKENS.get(tok)
    def session(self, uid, email):
        a, r = 'acc-' + uuid.uuid4().hex, 'ref-' + uuid.uuid4().hex
        TOKENS[a] = uid; REFRESH[r] = uid
        return {'access_token': a, 'refresh_token': r, 'expires_in': 3600, 'expires_at': int(time.time()) + 3600, 'token_type': 'bearer', 'user': {'id': uid, 'email': email}}
    def handle_any(self, method):
        u = urlparse(self.path); qs = parse_qs(u.query); p = u.path
        if self.headers.get('apikey') != KEY:
            return self.reply(401, {'message': 'Invalid API key'})
        with lock: LOG.append((method, p))
        try:
            if p == '/auth/v1/settings': return self.reply(200, {'external': {'email': True}})
            if p == '/auth/v1/signup':
                b = self.body(); email = b['email'].lower(); pw = b['password']
                if len(pw) < 6: return self.reply(422, {'msg': 'Password should be at least 6 characters'})
                ex = run("select id from auth.users where email=%s" % lit(email))
                if ex: return self.reply(422, {'msg': 'User already registered'})
                uid = str(uuid.uuid4()); run("insert into auth.users(id,email,pw,raw_user_meta_data) values (%s,%s,%s,%s)" % (lit(uid), lit(email), lit(pw), lit(json.dumps(b.get('data') or {}))))
                if CONFIRM_EMAIL: return self.reply(200, {'id': uid, 'email': email})
                return self.reply(200, self.session(uid, email))
            if p == '/auth/v1/token':
                b = self.body(); gt = qs.get('grant_type', [''])[0]
                if gt == 'password':
                    row = run("select id||'|'||email from auth.users where email=%s and pw=%s" % (lit(b['email'].lower()), lit(b['password'])))
                    if not row: return self.reply(400, {'error': 'invalid_grant', 'error_description': 'Invalid login credentials'})
                    uid, email = row.split('|'); return self.reply(200, self.session(uid, email))
                if gt == 'refresh_token':
                    uid = REFRESH.pop(b.get('refresh_token'), None)
                    if not uid: return self.reply(400, {'error_description': 'Invalid Refresh Token'})
                    email = run("select email from auth.users where id=%s" % lit(uid))
                    return self.reply(200, self.session(uid, email))
            if p == '/auth/v1/user':
                uid = self.uid()
                if not uid: return self.reply(401, {'msg': 'invalid JWT'})
                if method == 'PUT':
                    b = self.body() or {}
                    if 'password' in b:
                        if len(b['password']) < 6: return self.reply(422, {'msg': 'Password should be at least 6 characters'})
                        if run("select 1 from auth.users where id=%s and pw=%s" % (lit(uid), lit(b['password']))):
                            return self.reply(422, {'msg': 'New password should be different from the old password.'})
                        run("update auth.users set pw=%s where id=%s" % (lit(b['password']), lit(uid)))
                    if 'email' in b:
                        ne = b['email'].lower()
                        if run("select 1 from auth.users where email=%s and id<>%s" % (lit(ne), lit(uid))):
                            return self.reply(422, {'msg': 'A user with this email address has already been registered'})
                        if PENDING_MODE[0]: PENDING[uid] = ne
                        else: run("update auth.users set email=%s where id=%s" % (lit(ne), lit(uid)))
                if method == 'POST' and self.path.endswith('?confirm'):
                    ne = PENDING.pop(uid, None)
                    if ne: run("update auth.users set email=%s where id=%s" % (lit(ne), lit(uid)))
                email = run("select email from auth.users where id=%s" % lit(uid))
                return self.reply(200, {'id': uid, 'email': email, 'new_email': PENDING.get(uid)})
            if p in ('/auth/v1/logout', '/auth/v1/recover'): return self.reply(204 if p.endswith('logout') else 200, None if p.endswith('logout') else {})
            uid = self.uid()
            if p.startswith('/rest/v1/') and not uid and self.headers.get('Authorization'):
                return self.reply(401, {'code': 'PGRST301', 'message': 'JWT expired'})
            if p.startswith('/rest/v1/rpc/'):
                fn = p.rsplit('/', 1)[1]; b = self.body() or {}
                args = ', '.join('%s => %s' % (k, 'null' if v is None else (('true' if v else 'false') if isinstance(v, bool) else lit(v))) for k, v in b.items())
                if fn in SETOF: sql = "select coalesce(json_agg(x),'[]') from public.%s(%s) x" % (fn, args)
                else: sql = "select coalesce(to_json(public.%s(%s))::text,'null')" % (fn, args)
                out = run(sql, uid)
                return self.reply(200, json.loads(out) if out else None)
            m = re.match(r'^/rest/v1/(user_docs|shared_recipes|attachments|profiles|invites|settings|ref_ingredients)$', p)
            if m:
                table = m.group(1)
                where = []
                for k, vs in qs.items():
                    if k in ('select', 'order', 'limit', 'on_conflict'): continue
                    v = vs[0]; op, val = v.split('.', 1)
                    where.append('%s %s %s' % (k, {'eq': '=', 'gt': '>'}[op], lit(val)))
                wsql = ('where ' + ' and '.join(where)) if where else ''
                if method == 'GET':
                    cols = qs.get('select', ['*'])[0]
                    order = 'order by updated_at asc' if 'order' in qs else ''
                    lim = int(qs.get('limit', ['1000'])[0])
                    sql = "select coalesce(json_agg(t),'[]') from (select %s from public.%s %s %s limit %d) t" % (cols, table, wsql, order, lim)
                    return self.reply(200, json.loads(run(sql, uid)))
                if method == 'POST':
                    rows = self.body(); cols = list(rows[0].keys())
                    conf = qs.get('on_conflict', [''])[0]
                    upd = ', '.join('%s=excluded.%s' % (c, c) for c in cols if c not in conf.split(','))
                    sql = ("insert into public.%s(%s) select %s from json_populate_recordset(null::public.%s, %s) on conflict (%s) do update set %s"
                           % (table, ','.join(cols), ','.join(cols), table, lit(json.dumps(rows)), conf, upd))
                    run(sql, uid); return self.reply(201)
                if method == 'DELETE':
                    run("delete from public.%s %s" % (table, wsql), uid); return self.reply(204)
            return self.reply(404, {'message': 'not found ' + p})
        except PgErr as e:
            st = 403 if e.code == '42501' else 400
            return self.reply(st, {'code': e.code, 'message': e.msg})
    def do_GET(self): self.handle_any('GET')
    def do_PUT(self): self.handle_any('PUT')
    def do_POST(self): self.handle_any('POST')
    def do_DELETE(self): self.handle_any('DELETE')

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8787
    print('mock on', port, flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
