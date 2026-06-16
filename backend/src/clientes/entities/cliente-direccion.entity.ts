import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Cliente } from './cliente.entity';

@Entity('cliente_direcciones')
export class ClienteDireccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  calle: string;

  @Column({ name: 'nro_puerta', type: 'varchar', length: 20, nullable: true })
  nroPuerta: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  esquina1: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  esquina2: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  apto: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  local: string | null;

  @Column({ name: 'departamento_id', type: 'int', nullable: true })
  departamentoId: number | null;

  @Column({ name: 'localidad_id', type: 'int', nullable: true })
  localidadId: number | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  zona: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  nivel: string | null;

  @Column({ name: 'es_principal', type: 'boolean', default: false })
  esPrincipal: boolean;

  @Column({ name: 'en_zona', type: 'boolean', nullable: true })
  enZona: boolean | null;

  @ManyToOne(() => Cliente, (c) => c.direcciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;
}
