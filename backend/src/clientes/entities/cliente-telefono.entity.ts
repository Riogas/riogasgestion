import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Cliente } from './cliente.entity';

@Entity('cliente_telefonos')
export class ClienteTelefono {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  numero: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  alias: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  tipo: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVO' })
  estado: string;

  @Column({ name: 'es_principal', type: 'boolean', default: false })
  esPrincipal: boolean;

  @ManyToOne(() => Cliente, (c) => c.telefonos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;
}
