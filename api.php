<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__.'/config.php';

function out($ok,$data=[],$code=200){http_response_code($code);echo json_encode(['ok'=>$ok]+$data,JSON_UNESCAPED_UNICODE);exit;}
function body(){static $b=null;if($b===null){$b=json_decode(file_get_contents('php://input'),true) ?: [];}return $b;}
function db(){static $pdo=null;if($pdo)return $pdo;try{$pdo=new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset='.DB_CHARSET,DB_USER,DB_PASS,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);return $pdo;}catch(Throwable $e){out(false,['message'=>'Database belum terhubung. Periksa api/config.php.'],500);}}
function userId(){return (int)($_SESSION['user_id']??0);}
function requireUser(){if(!userId())out(false,['message'=>'Sesi login tidak ditemukan.'],401);return userId();}
function norm($s){return mb_strtolower(trim((string)$s),'UTF-8');}
function hashAnswer($s){return hash('sha256',norm($s));}
function hashPin($s){return hash('sha256',trim((string)$s));}
$pdo=db();$b=body();$action=$b['action']??$_GET['action']??'';
try{
 switch($action){
  case 'register':
   $name=trim($b['name']??'');$username=trim($b['username']??'');$email=trim($b['email']??'');$pass=(string)($b['password']??'');$q=trim($b['securityQuestion']??'');$ans=trim($b['securityAnswer']??'');$pin=trim($b['securityPin']??'');
   if(!$name||!$username||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($pass)<6||!$q||!$ans||!preg_match('/^\d{6}$/',$pin))out(false,['message'=>'Data pendaftaran belum lengkap atau tidak valid.'],422);
   $st=$pdo->prepare('SELECT id FROM users WHERE username=? OR email=? LIMIT 1');$st->execute([$username,$email]);if($st->fetch())out(false,['message'=>'Username atau email sudah digunakan.'],409);
   $st=$pdo->prepare('INSERT INTO users(name,username,email,password_hash,security_question,security_answer_hash,security_pin_hash) VALUES(?,?,?,?,?,?,?)');$st->execute([$name,$username,$email,password_hash($pass,PASSWORD_DEFAULT),$q,hashAnswer($ans),hashPin($pin)]);$id=(int)$pdo->lastInsertId();$_SESSION['user_id']=$id;$_SESSION['username']=$username;
   $defaults=['catatanKeuangan_v3'=>json_encode(['transactions'=>[],'income'=>[]]),'profilCatatanKeuangan'=>json_encode(['name'=>$name,'email'=>$email]),'targetCatatanKeuangan'=>json_encode([]),'notifCatatanKeuangan'=>json_encode(['limit'=>true,'transaction'=>true,'daily'=>true,'time'=>'08:00','permission'=>false,'last'=>'']),'achievementCatatanKeuangan_v2'=>json_encode([]),'theme'=>'light'];
   $ss=$pdo->prepare('INSERT INTO user_state(user_id,state_key,state_json) VALUES(?,?,?)');foreach($defaults as $k=>$v)$ss->execute([$id,$k,$v]);
   out(true,['user'=>['id'=>$id,'name'=>$name,'username'=>$username,'email'=>$email]]);
  case 'login':
   $u=trim($b['username']??'');$pass=(string)($b['password']??'');$st=$pdo->prepare('SELECT * FROM users WHERE username=? LIMIT 1');$st->execute([$u]);$usr=$st->fetch();if(!$usr||!password_verify($pass,$usr['password_hash']))out(false,['message'=>'Username atau password salah.'],401);
   $_SESSION['user_id']=(int)$usr['id'];$_SESSION['username']=$usr['username'];out(true,['user'=>['id'=>(int)$usr['id'],'name'=>$usr['name'],'username'=>$usr['username'],'email'=>$usr['email']]]);
  case 'state_get':
   $id=requireUser();$st=$pdo->prepare('SELECT state_key,state_json FROM user_state WHERE user_id=?');$st->execute([$id]);$states=[];foreach($st as $r)$states[$r['state_key']]=$r['state_json'];out(true,['states'=>$states]);
  case 'state_save':
   $id=requireUser();$k=trim($b['key']??'');$v=$b['value']??null;if(!preg_match('/^(catatanKeuangan_v3|profilCatatanKeuangan|targetCatatanKeuangan|notifCatatanKeuangan|achievementCatatanKeuangan_v2|theme)$/',$k))out(false,['message'=>'State tidak diizinkan.'],422);$json=is_string($v)?$v:json_encode($v,JSON_UNESCAPED_UNICODE);$st=$pdo->prepare('INSERT INTO user_state(user_id,state_key,state_json) VALUES(?,?,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json),updated_at=CURRENT_TIMESTAMP');$st->execute([$id,$k,$json]);out(true);
  case 'recovery_start':
   $u=trim($b['username']??'');$st=$pdo->prepare('SELECT id,username,security_question FROM users WHERE username=? LIMIT 1');$st->execute([$u]);$usr=$st->fetch();if(!$usr)out(false,['message'=>'Username tidak ditemukan.'],404);$_SESSION['recovery_user_id']=(int)$usr['id'];$_SESSION['recovery_verified']=false;out(true,['question'=>$usr['security_question']]);
  case 'recovery_verify':
   $rid=(int)($_SESSION['recovery_user_id']??0);$ans=trim($b['answer']??'');$pin=trim($b['pin']??'');if(!$rid)out(false,['message'=>'Sesi pemulihan tidak ditemukan.'],401);$st=$pdo->prepare('SELECT security_answer_hash,security_pin_hash FROM users WHERE id=?');$st->execute([$rid]);$usr=$st->fetch();if(!$usr||!hash_equals($usr['security_answer_hash'],hashAnswer($ans))||!hash_equals($usr['security_pin_hash'],hashPin($pin)))out(false,['message'=>'Verifikasi keamanan gagal.'],403);$_SESSION['recovery_verified']=true;$_SESSION['recovery_verified_until']=time()+600;out(true);
  case 'recovery_reset':
   $rid=(int)($_SESSION['recovery_user_id']??0);if(!$rid||empty($_SESSION['recovery_verified'])||time()>(int)($_SESSION['recovery_verified_until']))out(false,['message'=>'Verifikasi keamanan kedaluwarsa. Ulangi dari awal.'],403);$np=(string)($b['password']??'');if(strlen($np)<6)out(false,['message'=>'Password minimal 6 karakter.'],422);$st=$pdo->prepare('UPDATE users SET password_hash=? WHERE id=?');$st->execute([password_hash($np,PASSWORD_DEFAULT),$rid]);unset($_SESSION['recovery_user_id'],$_SESSION['recovery_verified'],$_SESSION['recovery_verified_until']);out(true);
  case 'logout':session_destroy();out(true);
  case 'me':$id=requireUser();$st=$pdo->prepare('SELECT id,name,username,email FROM users WHERE id=?');$st->execute([$id]);$usr=$st->fetch();out(true,['user'=>$usr]);
  default:out(false,['message'=>'Aksi API tidak dikenal.'],400);
 }
}catch(Throwable $e){out(false,['message'=>'Terjadi kesalahan server.'],500);}
