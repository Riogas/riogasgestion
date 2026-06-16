import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { TipoCliente, CategoriaCliente, EstadoCliente } from '../enums';
import { ClienteTelefono } from './cliente-telefono.entity';
import { ClienteDireccion } from './cliente-direccion.entity';

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'nro_cliente', type: 'int', nullable: true })
  nroCliente: number | null;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  apellido: string | null;

  @Column({ name: 'tipo_cliente', type: 'enum', enum: TipoCliente, default: TipoCliente.DOMESTICO })
  tipoCliente: TipoCliente;

  @Column({ type: 'enum', enum: CategoriaCliente, nullable: true })
  categoria: CategoriaCliente | null;

  @Column({ name: 'rut_ci', type: 'varchar', length: 32, nullable: true })
  rutCi: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  gci: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  privilegio: string | null;

  @Column({ name: 'obs_cliente', type: 'text', nullable: true })
  obsCliente: string | null;

  @Column({ name: 'obs_general', type: 'text', nullable: true })
  obsGeneral: string | null;

  @Column({ name: 'obs_comercial', type: 'text', nullable: true })
  obsComercial: string | null;

  @Column({ type: 'enum', enum: EstadoCliente, default: EstadoCliente.ACTIVO })
  estado: EstadoCliente;

  @Column({ name: 'fecha_alta', type: 'timestamptz', nullable: true })
  fechaAlta: Date | null;

  @Column({ name: 'fecha_ult_modif', type: 'timestamptz', nullable: true })
  fechaUltModif: Date | null;

  @Column({ name: 'fecha_ult_compra', type: 'timestamptz', nullable: true })
  fechaUltCompra: Date | null;

  @OneToMany(() => ClienteTelefono, (t) => t.cliente, { cascade: true, eager: false })
  telefonos: ClienteTelefono[];

  @OneToMany(() => ClienteDireccion, (d) => d.cliente, { cascade: true, eager: false })
  direcciones: ClienteDireccion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
