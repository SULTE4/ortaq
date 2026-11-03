#!/usr/bin/env python3
"""Exercise the running five-service demo. Creates a visible SMOKE TEST issue."""
import json, os, urllib.request, urllib.error, time
BASE = os.environ.get('ORTAQ_API', 'http://localhost:8080')

def request(method, path, body=None, token='', expected=(200,)):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={
        'Content-Type': 'application/json', **({'Authorization': 'Bearer '+token} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    assert status in expected, (method, path, status, raw.decode())
    return json.loads(raw) if raw else {}

def login(phone, invite=''):
    request('POST', '/auth/otp', {'phone': phone}, expected=(200,429))
    return request('POST', '/auth/verify', {'phone':phone, 'code':'1234', 'invite':invite})['token']

def main():
    request('GET','/health')
    resident = login('+77000000012')
    chairman = login('+77000000001')
    own = request('GET','/balances/me',token=resident)
    assert own['apartment'] == 45
    request('GET','/balances',token=resident,expected=(403,))
    request('GET','/balances/me?apartment=87',token=resident,expected=(403,))
    request('GET','/scene?balances=true',token=resident,expected=(403,))
    scene = request('GET','/scene',token=resident)
    assert 'balances' not in scene and '+770' not in json.dumps(scene)
    reports=request('GET','/reports',token=resident)
    assert len(reports)>=3 and reports[0]['expenses']
    issue=request('POST','/issues',{
        'title':'SMOKE TEST · radiator check', 'description':'Automated demo workflow check; safe to leave in the issue history.',
        'category':'Heating','location':{'entrance':2,'floor':6,'area':''},'photo':'/media/seed/issue.png'
    },resident,expected=(201,))
    path='/issues/'+issue['id']
    request('PATCH',path,{'status':'In Progress','contractor':'Astana Plumbing'},chairman)
    request('PATCH',path,{'status':'Resolved','contractor':'Astana Plumbing'},chairman,expected=(400,))
    request('PATCH',path,{'status':'Resolved','contractor':'Astana Plumbing','result_photo':'/media/seed/result.png'},chairman)
    notifications=request('GET','/notifications',token=resident)
    assert any(n['related_id']==issue['id'] and 'Resolved' in n['title'] for n in notifications)
    live=request('GET','/scene',token=resident)
    assert next(i for i in live['issues'] if i['id']==issue['id'])['status']=='Resolved'
    polls=request('GET','/polls',token=resident)
    for poll in polls:
        assert poll['advisory']
        assert ('results' in poll)==poll['closed']
    open_poll=next((p for p in polls if not p['closed']),None)
    if open_poll:
        request('POST','/polls/'+open_poll['id']+'/votes',{'option':0},resident,expected=(201,409))
        request('POST','/polls/'+open_poll['id']+'/votes',{'option':0},resident,expected=(409,))
    # Validate the nginx entrypoints too, including built Flutter bootstraps.
    for port, paths in {8081:['/','/flutter_bootstrap.js','/main.dart.js'],8082:['/','/flutter_bootstrap.js','/main.dart.js'],8083:['/']}.items():
        for path in paths:
            with urllib.request.urlopen('http://localhost:'+str(port)+path,timeout=15) as response:
                assert response.status==200 and response.read(32), (port,path)
    print('PASS · five services, auth, reports, issue workflow, live scene, notifications, polls and privacy')

if __name__=='__main__':
    main()
