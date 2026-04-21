"""
Simplificador de GeoJSON usando el algoritmo Douglas-Peucker.
Reduce la cantidad de puntos en polígonos sin deformar las formas.
No requiere dependencias externas.
"""

import json
import math
import sys
import os

# ─────────────────────────────────────────────
# Algoritmo Douglas-Peucker (Ramer-Douglas-Peucker)
# ─────────────────────────────────────────────

def point_line_distance(point, start, end):
    """Distancia perpendicular de un punto a la línea definida por start-end."""
    if start[0] == end[0] and start[1] == end[1]:
        return math.sqrt((point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2)
    
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    
    # Parámetro t de la proyección del punto sobre la línea
    t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)
    t = max(0, min(1, t))
    
    proj_x = start[0] + t * dx
    proj_y = start[1] + t * dy
    
    return math.sqrt((point[0] - proj_x) ** 2 + (point[1] - proj_y) ** 2)


def douglas_peucker(points, epsilon):
    """
    Simplifica una lista de puntos usando Douglas-Peucker.
    epsilon: tolerancia en las mismas unidades que las coordenadas (grados para lat/lon).
    """
    if len(points) <= 2:
        return points
    
    # Encontrar el punto más lejano de la línea start-end
    max_dist = 0
    max_idx = 0
    
    for i in range(1, len(points) - 1):
        dist = point_line_distance(points[i], points[0], points[-1])
        if dist > max_dist:
            max_dist = dist
            max_idx = i
    
    # Si la distancia máxima supera epsilon, recursivamente simplificar
    if max_dist > epsilon:
        left = douglas_peucker(points[:max_idx + 1], epsilon)
        right = douglas_peucker(points[max_idx:], epsilon)
        return left[:-1] + right
    else:
        return [points[0], points[-1]]


def simplify_ring(ring, epsilon, min_points=4):
    """
    Simplifica un anillo de polígono (ring = lista de coordenadas).
    Mantiene al menos min_points para que el polígono sea válido.
    Un polígono GeoJSON necesita mínimo 4 puntos (3 + cierre).
    """
    # Un anillo cerrado en GeoJSON: primer punto == último punto
    is_closed = len(ring) >= 2 and ring[0] == ring[-1]
    
    if is_closed:
        # Simplificar sin el último punto (que es duplicado del primero)
        simplified = douglas_peucker(ring[:-1], epsilon)
        # Asegurar mínimo de puntos
        if len(simplified) < min_points - 1:
            return ring  # No simplificar si quedaría muy pobre
        # Re-cerrar el anillo
        simplified.append(simplified[0])
        return simplified
    else:
        simplified = douglas_peucker(ring, epsilon)
        if len(simplified) < min_points:
            return ring
        return simplified


def simplify_geometry(geometry, epsilon):
    """Simplifica la geometría de una feature GeoJSON."""
    geom_type = geometry.get("type", "")
    coords = geometry.get("coordinates", [])
    
    if geom_type == "Polygon":
        # Polygon: lista de anillos [exterior, ...huecos]
        new_coords = []
        for ring in coords:
            new_coords.append(simplify_ring(ring, epsilon))
        geometry["coordinates"] = new_coords
        
    elif geom_type == "MultiPolygon":
        # MultiPolygon: lista de polígonos, cada uno con lista de anillos
        new_multi = []
        for polygon in coords:
            new_polygon = []
            for ring in polygon:
                new_polygon.append(simplify_ring(ring, epsilon))
            new_multi.append(new_polygon)
        geometry["coordinates"] = new_multi
        
    elif geom_type == "LineString":
        geometry["coordinates"] = douglas_peucker(coords, epsilon)
        
    elif geom_type == "MultiLineString":
        geometry["coordinates"] = [douglas_peucker(line, epsilon) for line in coords]
    
    return geometry


def count_points(geometry):
    """Cuenta el total de puntos en una geometría."""
    geom_type = geometry.get("type", "")
    coords = geometry.get("coordinates", [])
    total = 0
    
    if geom_type in ("Polygon",):
        for ring in coords:
            total += len(ring)
    elif geom_type in ("MultiPolygon",):
        for polygon in coords:
            for ring in polygon:
                total += len(ring)
    elif geom_type in ("LineString",):
        total = len(coords)
    elif geom_type in ("MultiLineString",):
        for line in coords:
            total += len(line)
    elif geom_type == "Point":
        total = 1
    
    return total


def main():
    # ─── Configuración ───
    input_file = os.path.join(os.path.dirname(__file__), "..", "public", "geojsons", "zonas_4_2.BACKUP.geojson")
    output_file = os.path.join(os.path.dirname(__file__), "..", "public", "geojsons", "zonas_4_2.geojson")
    
    # Tolerancia en grados. 
    # ~0.0001° ≈ 11 metros en Uruguay → buena simplificación sin deformar
    # ~0.0003° ≈ 33 metros → más agresivo
    # ~0.00005° ≈ 5.5 metros → conservador
    EPSILON = 0.0001  # ~11 metros
    
    print(f"═══════════════════════════════════════════════")
    print(f"  Simplificador de GeoJSON (Douglas-Peucker)")
    print(f"═══════════════════════════════════════════════")
    print(f"  Tolerancia: {EPSILON}° (~{EPSILON * 111000:.0f} metros)")
    print(f"  Input:  {os.path.basename(input_file)}")
    print(f"  Output: {os.path.basename(output_file)}")
    print()
    
    # Leer archivo
    print("Leyendo GeoJSON original...")
    with open(input_file, "r", encoding="utf-8") as f:
        geojson = json.load(f)
    
    features = geojson.get("features", [])
    print(f"  Features encontradas: {len(features)}")
    
    # Contar puntos antes
    total_before = 0
    for feat in features:
        total_before += count_points(feat.get("geometry", {}))
    print(f"  Puntos totales (original): {total_before:,}")
    
    original_size = os.path.getsize(input_file)
    print(f"  Tamaño archivo original: {original_size / 1024:.0f} KB ({original_size / (1024*1024):.1f} MB)")
    print()
    
    # Simplificar cada feature
    print("Simplificando polígonos...")
    for i, feat in enumerate(features):
        geom = feat.get("geometry")
        if geom:
            before = count_points(geom)
            simplify_geometry(geom, EPSILON)
            after = count_points(geom)
            zona_code = feat.get("properties", {}).get("Codigo", "?") or "?"
            if before != after:
                reduction = (1 - after / before) * 100 if before > 0 else 0
                print(f"  Zona {str(zona_code):>4}: {before:>5} → {after:>5} puntos ({reduction:.0f}% reduccion)")
    
    # Contar puntos después
    total_after = 0
    for feat in features:
        total_after += count_points(feat.get("geometry", {}))
    
    # Escribir resultado
    print()
    print("Escribiendo GeoJSON simplificado...")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)
    
    new_size = os.path.getsize(output_file)
    
    # Resumen
    print()
    print(f"═══════════════════════════════════════════════")
    print(f"  RESUMEN")
    print(f"═══════════════════════════════════════════════")
    print(f"  Puntos: {total_before:,} → {total_after:,} ({(1 - total_after/total_before)*100:.1f}% reducción)")
    print(f"  Tamaño: {original_size/1024:.0f} KB → {new_size/1024:.0f} KB ({(1 - new_size/original_size)*100:.1f}% reducción)")
    print(f"  Backup: zonas_4_2.BACKUP.geojson")
    print(f"═══════════════════════════════════════════════")


if __name__ == "__main__":
    main()
