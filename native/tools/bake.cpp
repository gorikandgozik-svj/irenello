// Offline city authoring tool. Each sector is independently loadable by ResourceLoader.
#include <filesystem>
#include <fstream>
#include <random>
#include <string>
#include <iostream>
using namespace std;
int main(int argc,char**argv){
 filesystem::path dir=argc>1?argv[1]:"city";filesystem::create_directories(dir);
 ofstream catalog(dir/"skyline.txt");
 for(int x=-4;x<=4;++x)for(int z=-4;z<=4;++z){
  mt19937 rng(8341+(x+4)*93+z);
  ofstream f(dir/(to_string(x)+"_"+to_string(z)+".tscn"));
  f<<"[gd_scene format=3]\n[ext_resource type=\"BoxMesh\" path=\"res://block.tres\" id=\"1\"]\n"
   <<"[sub_resource type=\"BoxShape3D\" id=\"shape\"]\n"
   <<"[node name=\"Sector\" type=\"Node3D\"]\n";
  int id=0;
  for(int a=0;a<3;++a)for(int b=0;b<3;++b){
   int px=a*32+16,pz=b*32+16,h=8+rng()%48,w=12+rng()%11,d=12+rng()%11;
   catalog<<x<<','<<z<<','<<px<<','<<pz<<','<<w<<','<<h<<','<<d<<'\n';
   string name="House"+to_string(++id);
   f<<"[node name=\""<<name<<"\" type=\"MeshInstance3D\" parent=\".\"]\nmesh = ExtResource(\"1\")\nposition = Vector3("<<px<<","<<h*.5<<","<<pz<<")\nscale = Vector3("<<w<<","<<h<<","<<d<<")\n"
    <<"[node name=\"Body\" type=\"StaticBody3D\" parent=\""<<name<<"\"]\n"
    <<"[node name=\"Collision\" type=\"CollisionShape3D\" parent=\""<<name<<"/Body\"]\nshape = SubResource(\"shape\")\n";
  }
  if(!f)return 1;
 }
 cout<<"81 sectors, 729 buildings\n";return !catalog;
}
