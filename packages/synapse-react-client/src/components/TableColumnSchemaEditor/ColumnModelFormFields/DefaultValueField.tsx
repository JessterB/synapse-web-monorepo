import React, { useMemo } from 'react'
import { ColumnTypeEnum } from '@sage-bionetworks/synapse-types'
import {
  FormControl,
  MenuItem,
  Select,
  SelectProps,
  TextField,
  TextFieldProps,
} from '@mui/material'
import { getTextFieldType } from '../TableColumnSchemaEditorUtils'

export type DefaultValueFieldProps<T> = {
  columnType: ColumnTypeEnum
  value: T
  onChange: (newValue: T) => void
  TextFieldProps?: Omit<TextFieldProps, 'value' | 'onChange'>
  SelectProps?: Omit<SelectProps, 'value' | 'onChange'>
}

export default function DefaultValueField<T>(props: DefaultValueFieldProps<T>) {
  const { columnType, onChange, value, TextFieldProps, SelectProps } = props

  const textFieldType: TextFieldProps['type'] = useMemo(
    () => getTextFieldType(columnType),
    [columnType],
  )

  if (columnType === ColumnTypeEnum.BOOLEAN) {
    return (
      <FormControl fullWidth>
        <Select
          {...SelectProps}
          value={value}
          onChange={e => {
            if (e.target.value == undefined) {
              onChange(undefined as T)
            } else {
              onChange((e.target.value === 'true') as T)
            }
          }}
        >
          <MenuItem value={undefined}>{''}</MenuItem>
          <MenuItem value={'true'}>true</MenuItem>
          <MenuItem value={'false'}>false</MenuItem>
        </Select>
      </FormControl>
    )
  }

  return (
    <TextField
      {...TextFieldProps}
      type={textFieldType}
      value={value}
      onChange={event => onChange(event.target.value as T)}
    />
  )
}
