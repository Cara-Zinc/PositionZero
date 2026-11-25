"""Build an editable stylized Death king in Blender, then export a local GLB."""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "design/3d-death-king-v1"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
piece = bpy.data.collections.new("BLACK KING · Crowned Death")
scene.collection.children.link(piece)
studio = bpy.data.collections.new("STUDIO · not exported")
scene.collection.children.link(studio)

def material(name, color, metallic=0, roughness=.38):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = roughness
    return m

black = material("Charcoal enamel", (.018,.022,.028), .05, .34)
fold = material("Raised charcoal folds", (.033,.040,.050), .04,.4)
gold = material("Antique gold", (.72,.43,.12), .65,.28)
ivory = material("Warm ivory porcelain", (.87,.80,.63), .0,.3)
socket = material("Skull cavity", (.007,.005,.004), 0,.85)
oxblood = material("Oxblood board", (.23,.009,.018), 0,.45)
parchment = material("Parchment board", (.64,.48,.28), 0,.55)

def finish(o, name, mat, target=piece, smooth=True):
    o.name = name
    for c in list(o.users_collection): c.objects.unlink(o)
    target.objects.link(o)
    o.data.materials.append(mat)
    if o.type == 'MESH' and smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o

def ellipsoid(name, location, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location)
    o = finish(bpy.context.object,name,mat)
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o

def mesh(name, vertices, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    o = bpy.data.objects.new(name,data)
    piece.objects.link(o)
    data.materials.append(mat)
    if smooth:
        for p in data.polygons: p.use_smooth=True
    return o

def curve(name, points, radius, mat, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions='3D'
    data.resolution_u=12
    data.bevel_depth=radius
    data.bevel_resolution=3
    spline=data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points,points):
        p.co=co
        p.handle_left_type=p.handle_right_type='AUTO'
    spline.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,data)
    piece.objects.link(o)
    data.materials.append(mat)
    return o

def cylinder(name, loc, radius, depth, mat, vertices=64, scale=(1,1,1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o=finish(bpy.context.object,name,mat)
    o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=o.modifiers.new("Soft porcelain edges",'BEVEL')
    bevel.width=.025
    bevel.segments=3
    o.modifiers.new("Weighted normals",'WEIGHTED_NORMAL')
    return o

# A broad oval pedestal, separate editable porcelain/gold elements.
cylinder("Pedestal · gold footing",(0,0,.07),.91,.14,gold,scale=(1,.78,1))
cylinder("Pedestal · ivory",(0,0,.17),.86,.13,ivory,scale=(1,.78,1))
cylinder("Pedestal · gold upper lip",(0,0,.245),.81,.035,gold,scale=(1,.78,1))

# Sweeping radial robe with physical folds all the way around.
profiles=[(.27,.77,.50),(.36,.75,.48),(.65,.70,.44),(1.0,.66,.40),
          (1.4,.60,.36),(1.8,.63,.36),(2.12,.74,.38),(2.33,.73,.35),
          (2.46,.47,.28),(2.53,.25,.22)]
verts=[]
N=96
for z,rx,ry in profiles:
    for i in range(N):
        a=2*math.pi*i/N
        wave=1+.055*math.cos(9*a+z*1.7)+.02*math.sin(5*a-z)
        verts.append((rx*math.cos(a)*wave,ry*math.sin(a)*wave,z))
faces=[tuple(range(N-1,-1,-1))]
for j in range(len(profiles)-1):
    for i in range(N):
        ni=(i+1)%N
        faces.append((j*N+i,j*N+ni,(j+1)*N+ni,(j+1)*N+i))
faces.append(tuple((len(profiles)-1)*N+i for i in range(N)))
robe=mesh("Robe · continuous folded volume",verts,faces,black)
sub=robe.modifiers.new("Soft drape",'SUBSURF')
sub.levels=1

# Broad gold mantle and hem ribbons following actual curved surfaces.
curve("Mantle · gold shoulder sweep",[(-.73,-.24,2.29),(-.52,-.40,2.39),(-.24,-.43,2.36),(0,-.40,2.32),(.34,-.40,2.39),(.72,-.23,2.29)],.053,gold)
curve("Robe · left sweeping gold border",[(-.39,-.41,2.28),(-.47,-.45,1.85),(-.54,-.47,1.28),(-.67,-.46,.72),(-.72,-.38,.37)],.036,gold)
curve("Robe · right sweeping gold border",[(.42,-.38,2.27),(.52,-.43,1.85),(.53,-.45,1.34),(.64,-.44,.84),(.73,-.33,.36)],.036,gold)
curve("Robe · lower gold hem",[(.77*math.cos(a),.51*math.sin(a),.34+.023*math.sin(5*a)) for a in [2*math.pi*i/32 for i in range(32)]],.037,gold,True)
for x in [-.38,-.22,.27,.43]:
    curve("Robe · broad raised fold",[(x*.8,-.36,1.75),(x,-.40,1.22),(x*1.4,-.47,.55)],.04,fold)

# Hood is a real domed shell, open at the front (-Y).
v=[]; f=[]
steps=40; rings=20
for j in range(rings+1):
    theta=.10+(math.pi-.20)*j/rings
    for i in range(steps+1):
        # Leave a generous 120-degree face opening at front.
        a=-math.pi/6 + (4*math.pi/3)*i/steps
        v.append((.51*math.sin(theta)*math.cos(a),.43*math.sin(theta)*math.sin(a)+.015,2.87+.55*math.cos(theta)))
for j in range(rings):
    for i in range(steps):
        p=j*(steps+1)+i
        f.append((p,p+1,p+steps+2,p+steps+1))
hood=mesh("Hood · open domed shell",v,f,black)
sol=hood.modifiers.new("Hood thickness",'SOLIDIFY'); sol.thickness=.07
curve("Hood · golden face rim",[(-.39,-.25,2.44),(-.46,-.31,2.68),(-.41,-.35,3.02),(-.26,-.33,3.24),(0,-.30,3.32),(.26,-.33,3.24),(.41,-.35,3.02),(.46,-.31,2.68),(.39,-.25,2.44)],.028,gold)
ellipsoid("Neck",(0,-.08,2.58),(.14,.14,.20),ivory)

# Skull: solid ivory cranium, recessed boolean eye sockets and nasal cavity.
head=ellipsoid("Skull · cranium",(0,-.26,2.95),(.315,.265,.34),ivory)
for x in [-.135,.135]:
    cutter=ellipsoid("Temporary eye cutter",(x,-.485,3.02),(.092,.105,.10),socket)
    bpy.context.view_layer.objects.active=head
    mod=head.modifiers.new("Recessed eye socket",'BOOLEAN')
    mod.operation='DIFFERENCE'; mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    ellipsoid("Eye socket · deep recess",(x,-.43,3.02),(.074,.046,.078),socket)
ellipsoid("Skull · left cheek",(-.20,-.39,2.85),(.092,.10,.10),ivory)
ellipsoid("Skull · right cheek",(.20,-.39,2.85),(.092,.10,.10),ivory)
ellipsoid("Skull · jaw",(0,-.34,2.74),(.21,.18,.105),ivory)
mesh("Skull · nasal triangle",[(-.045,-.515,2.89),(.045,-.515,2.89),(0,-.54,2.98),(0,-.45,2.90)],[(0,1,2),(0,3,1),(0,2,3),(1,3,2)],socket,False)
ellipsoid("Mouth · dark inset",(0,-.485,2.785),(.16,.025,.052),socket)
for j,z in enumerate([2.80,2.76]):
    for i in range(7):
        ellipsoid("Skull · tooth %d-%d"%(j,i),((i-3)*.041,-.507,z),(.017,.02,.02),ivory)

# Closed gold crown band with eight actual sculpted points.
v=[]; f=[]; n=64
for i in range(n):
    a=2*math.pi*i/n
    point=(1+math.cos(8*a))/2
    for r,z in [(.425,3.22),(.425+.045*point,3.32+.21*point),(.365+.045*point,3.32+.21*point),(.365,3.22)]:
        v.append((r*math.cos(a),r*.85*math.sin(a),z))
for i in range(n):
    ni=(i+1)%n
    for k in range(4): f.append((i*4+k,ni*4+k,ni*4+(k+1)%4,i*4+(k+1)%4))
mesh("Crown · eight raised points",v,f,gold)
curve("Crown · lower gold bead",[(.43*math.cos(a),.366*math.sin(a),3.235) for a in [2*math.pi*i/32 for i in range(32)]],.027,gold,True)

# Bent arms, wide sleeves, stacked ivory hands gripping the central hilt.
for side in [-1,1]:
    curve("Sleeve · %s"%side,[(side*.60,-.22,2.25),(side*.68,-.46,2.02),(side*.43,-.59,1.89)],.205,black)
    curve("Forearm · %s"%side,[(side*.43,-.62,1.91),(side*.29,-.73,2.04 if side<0 else 1.90),(side*.09,-.77,2.09 if side<0 else 1.92)],.084,ivory)
    curve("Cuff · %s"%side,[(side*.51,-.64,1.78),(side*.42,-.75,1.88),(side*.40,-.70,2.03)],.033,gold)
    z=2.10 if side<0 else 1.93
    ellipsoid("Hand · stacked grip %s"%side,(side*.05,-.79,z),(.15,.075,.095),ivory)
    for i in range(3):
        curve("Finger · %s-%s"%(side,i),[(side*.11,-.85,z+.045-i*.032),(0,-.865,z+.045-i*.032),(-side*.035,-.825,z+.025-i*.032)],.017,ivory)

# Sword, actual diamond-section blade instead of a textured plane.
v=[(-.11,-.785,.39),(.11,-.785,.39),(0,-.83,.39),(0,-.74,.39),
   (-.10,-.785,1.78),(.10,-.785,1.78),(0,-.83,1.78),(0,-.74,1.78),(0,-.785,.30)]
mesh("Sword · ivory diamond blade",v,[(0,4,6,2),(2,6,5,1),(1,5,7,3),(3,7,4,0),(0,2,8),(2,1,8),(1,3,8),(3,0,8),(4,7,5,6)],ivory,False)
curve("Sword · gilded central ridge",[(0,-.835,.37),(0,-.835,1.75)],.012,gold)
curve("Sword · curved crossguard",[(-.28,-.785,1.75),(-.17,-.785,1.80),(0,-.785,1.78),(.17,-.785,1.80),(.28,-.785,1.75)],.041,gold)
cylinder("Sword · hilt",(0,-.79,2.015),.047,.43,gold,32)
ellipsoid("Sword · pommel",(0,-.79,2.25),(.073,.065,.065),gold)
for side in [-1,1]:
    ellipsoid("Bare foot · %s"%side,(side*.42,-.43,.32),(.18,.19,.074),ivory)

# A small scarlet/ivory board stage in a separate collection, not part of GLB.
for x in range(-1,2):
    for y in range(-1,2):
        bpy.ops.mesh.primitive_cube_add(size=1,location=(x*2.1,y*2.1,-.035))
        o=finish(bpy.context.object,"Board square %s %s"%(x,y),oxblood if (x+y)%2==0 else parchment,studio,False)
        o.scale=(1.05,1.05,.035)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)

def aim(o,target): o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def camera(name,loc):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);studio.objects.link(o)
    o.location=loc;aim(o,(0,0,1.65));d.type='ORTHO';d.ortho_scale=4.7;return o
front=camera("Camera · three-quarter",(4,-8,4.3))
back=camera("Camera · rear",(-4,8,4.3))
scene.camera=front
for name,loc,power,size in [("Key",(-3,-4,7),750,4),("Fill",(4,-2,4),450,3),("Rim",(1,4,6),900,3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=loc;aim(o,(0,0,1.5))
scene.world=bpy.data.worlds.new("Quiet studio")
scene.world.use_nodes=True
scene.world.node_tree.nodes["Background"].inputs[0].default_value=(.16,.16,.16,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value=.35
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'

# Export only editable piece geometry; apply curves/boolean geometry in GLB.
bpy.ops.object.select_all(action='DESELECT')
for o in piece.objects: o.select_set(True)
bpy.context.view_layer.objects.active=robe
bpy.ops.export_scene.gltf(filepath=str(OUT/"black-king.glb"),export_format='GLB',use_selection=True,export_apply=True)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
scene.render.filepath=str(OUT/"preview.png")
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"black-king.blend"))
bpy.ops.render.render(write_still=True)
scene.camera=back
scene.render.filepath=str(OUT/"rear.png")
bpy.ops.render.render(write_still=True)
scene.camera=front
summary={"objects":len(piece.objects),"materials":[black.name,gold.name,ivory.name],"height":3.53,"forward":"-Y in Blender; glTF exporter converts to Y-up","scope":"Stylized geometric prototype, not a sculptural replica; not installed in app."}
(OUT/"manifest.json").write_text(json.dumps(summary,indent=2)+"\n")
assert (OUT/"black-king.glb").read_bytes()[:4]==b"glTF"
print("PASS: editable Blender scene, GLB and front/rear renders saved.")
